//! Tauri 2 thin native host (GOAL Phase 18, KODEX §13).
//!
//! Responsibilities ONLY: React hosting, HostBridge IPC, scanner lifecycle,
//! filesystem export, resource paths, packaging, native dialogs, process
//! supervision, narrowly scoped Windows integration. No detection semantics
//! in commands — the scanner sidecar (Node worker bundling
//! packages/scanner + packages/detection) owns crawl + detection; this host
//! supervises it and persists its validated output.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod job;
#[cfg(not(windows))]
mod job_fallback;
mod session;
mod evidence;

use session::{load_cancelled_bundle, validate_detail_bundle, validate_extra_bundle, validate_sidecar_stdout, SessionOutcome, SessionRegistry};
use std::sync::Arc;
use tauri::{Emitter, Manager, State, WebviewWindowBuilder};

struct AppState {
    registry: Arc<SessionRegistry>,
}

#[derive(Debug, serde::Deserialize)]
struct ScanLimitsArg {
    #[serde(rename = "maxPages")]
    max_pages: Option<u32>,
    #[serde(rename = "maxDepth")]
    max_depth: Option<u32>,
    #[serde(rename = "timeoutSec")]
    timeout_sec: Option<u64>,
}

#[derive(Debug, serde::Deserialize)]
struct ScanStartRequest {
    #[serde(rename = "entryUrl")]
    entry_url: String,
    limits: Option<ScanLimitsArg>,
}

#[tauri::command]
async fn scan_start(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: ScanStartRequest,
) -> Result<serde_json::Value, String> {
    if request.entry_url.trim().is_empty() {
        return Err("entryUrl is required".to_string());
    }
    let parsed = url_like_valid(&request.entry_url)?;
    let none_limits = ScanLimitsArg {
        max_pages: None,
        max_depth: None,
        timeout_sec: None,
    };
    let limits = request.limits.as_ref().unwrap_or(&none_limits);
    let max_pages = limits.max_pages.unwrap_or(200);
    let max_depth = limits.max_depth.unwrap_or(4);
    let timeout_sec = limits.timeout_sec.unwrap_or(1500);
    if max_pages == 0 || max_pages > 2000 {
        return Err("maxPages must be 1..=2000".to_string());
    }
    if max_depth > 10 {
        return Err("maxDepth must be 0..=10".to_string());
    }
    if timeout_sec < 60 || timeout_sec > 1500 {
        return Err("timeoutSec must be 60..=1500".to_string());
    }
    let started_at = chrono::Utc::now().to_rfc3339();
    let record = session::new_session(parsed.clone(), started_at.clone());
    let session_id = record.id.clone();
    state.registry.insert(record).await;
    // Bundled worker script (resources/binaries/scanner-worker*.mjs). No silent
    // heartbeat: if the sidecar is absent the session must fail loudly
    // instead of freezing the UI on zero counters.
    let Some(path) = sidecar_path(&app) else {
        let detail = "scanner worker script not found in the app resources".to_string();
        state.registry.fail(&session_id, detail.clone(), chrono::Utc::now().to_rfc3339()).await;
        return Err(detail);
    };
    {
        let args: Vec<String> = vec![
            "--session".to_string(),
            session_id.clone(),
            "--entry-url".to_string(),
            parsed.clone(),
            "--max-pages".to_string(),
            max_pages.to_string(),
            "--max-depth".to_string(),
            max_depth.to_string(),
            "--timeout-sec".to_string(),
            timeout_sec.to_string(),
            // Channel stays opt-in: session-0 QGA cannot launch Edge
            // (exit 1002 OBSERVED); default uses headless shell.
            // Shell-safe capture path (PowerShell `>` forces UTF-16).
            "--out-file".to_string(),
            std::env::temp_dir()
                .join(format!("krds-result-{session_id}.json"))
                .to_string_lossy()
                .into_owned(),
            "--detail-out-file".to_string(),
            std::env::temp_dir()
                .join(format!("krds-detail-{session_id}.json"))
                .to_string_lossy()
                .into_owned(),
            "--extra-out-file".to_string(),
            std::env::temp_dir()
                .join(format!("krds-extra-{session_id}.json"))
                .to_string_lossy()
                .into_owned(),
        ];
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        if let Err(detail) = state.registry.spawn_sidecar(&session_id, &path, &arg_refs).await {
            state.registry.fail(&session_id, detail.clone(), chrono::Utc::now().to_rfc3339()).await;
            return Err(format!("scanner sidecar failed to start ({path}): {detail}"));
        }
        let app_handle = app.clone();
        let forward_handle = app.clone();
        let registry = state.registry.inner_clone();
        let finished_session = session_id.clone();
        let finished_entry = parsed.clone();
        tauri::async_runtime::spawn(async move {
            let sink: session::ProgressSink = std::sync::Arc::new(move |event| {
                let _ = forward_handle.emit("scan-event", event);
            });
            let guard_sec = timeout_sec.min(1650);
            let outcome = match tokio::time::timeout(
                std::time::Duration::from_secs(guard_sec),
                registry.wait_sidecar_with_progress(&finished_session, sink),
            ).await {
                Ok(outcome) => outcome,
                Err(_) => {
                    if registry.terminate_at_deadline(&finished_session, chrono::Utc::now().to_rfc3339()).await {
                        SessionOutcome::Failed { detail: "scan deadline reached; worker process stopped".to_string() }
                    } else {
                        SessionOutcome::Cancelled
                    }
                }
            };
            finish_session(
                &app_handle,
                &registry,
                &finished_session,
                &finished_entry,
                outcome,
            )
            .await;
        });
    }
    app.emit(
        "scan-event",
        serde_json::json!({
            "kind": "session-started",
            "sessionId": session_id,
            "at": started_at,
            "progress": {"sequence": 0, "visitedPages": 0, "failedPages": 0, "queuedPages": 0, "currentPages": [], "recentActivity": [], "framesInspected": 0, "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": 0, "elapsedSec": 0, "stage": "running"},
            "pageUrl": parsed,
        }),
    )
    .map_err(|e| e.to_string())?;
    state.registry.snapshot(&session_id).await.ok_or_else(|| "unknown session".to_string())
}

/// Sidecar completion: persist validated stdout, mark status, notify the UI.
/// Validation failure marks the session failed (release-blocking, KODEX §38).
async fn finish_session(
    app: &tauri::AppHandle,
    registry: &Arc<SessionRegistry>,
    session_id: &str,
    entry_url: &str,
    outcome: SessionOutcome,
) {
    let finished_at = chrono::Utc::now().to_rfc3339();
    let detail_path = std::env::temp_dir().join(format!("krds-detail-{session_id}.json"));
    let extra_path = std::env::temp_dir().join(format!("krds-extra-{session_id}.json"));
    let result_path = std::env::temp_dir().join(format!("krds-result-{session_id}.json"));
    match outcome {
        SessionOutcome::Succeeded { stdout } => {
            let validated = (|| {
                let canonical = validate_sidecar_stdout(entry_url, &stdout)?;
                let detail = std::fs::read_to_string(&detail_path).map_err(|e| format!("detail manifest missing: {e}"))?;
                let extra = std::fs::read_to_string(&extra_path).map_err(|e| format!("extra result missing: {e}"))?;
                validate_extra_bundle(&canonical, &extra)?;
                validate_detail_bundle(&canonical, &detail, &extra)?;
                Ok((canonical, detail, extra))
            })();
            match validated {
                Ok((canonical, detail, extra)) => {
                    registry.store_result(session_id, canonical, detail, extra, finished_at.clone()).await;
                }
                Err(detail) => {
                    registry.fail(session_id, detail, finished_at.clone()).await;
                }
            }
        }
        SessionOutcome::Failed { detail } => {
            registry.fail(session_id, detail, finished_at.clone()).await;
        }
        SessionOutcome::Cancelled => {}
    }
    // Acceptance of cancellation is recorded under the same lock as success
    // and failure. It wins even when it arrives during artifact validation.
    if registry.cancellation_requested(session_id).await {
        let retained = load_cancelled_bundle(entry_url, &result_path, &detail_path, &extra_path);
        let (bundle, error) = match retained {
            Ok(bundle) => (Some(bundle), None),
            Err(error) => (None, Some(error)),
        };
        registry.complete_cancellation(session_id, bundle, error, finished_at.clone()).await;
    }
    let Some(snapshot) = registry.snapshot(session_id).await else { return; };
    let status = snapshot["status"].as_str().unwrap_or("failed");
    let (kind, message) = match status {
        "succeeded" => ("session-finished", "탐지가 완료되었습니다."),
        "cancelled" if snapshot["hasResult"] == true => ("session-cancelled", "중지 전 확인한 결과가 저장되었습니다."),
        "cancelled" => ("session-cancelled", "점검이 중지되었습니다. 저장된 결과가 없습니다."),
        _ => ("session-failed", snapshot["error"].as_str().unwrap_or("점검을 완료하지 못했습니다.")),
    };
    let _ = std::fs::remove_file(detail_path);
    let _ = std::fs::remove_file(extra_path);
    let _ = std::fs::remove_file(result_path);
    let progress = registry.progress_snapshot(session_id).await;
    let _ = app.emit(
        "scan-event",
        serde_json::json!({
            "kind": kind,
            "sessionId": session_id,
            "at": finished_at,
            "progress": progress.terminal_value(status),
            "message": message,
            "pageUrl": entry_url,
        }),
    );
}

#[tauri::command]
async fn scan_cancel(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let finished_at = chrono::Utc::now().to_rfc3339();
    if !state.registry.cancel(&session_id, finished_at.clone()).await {
        return Err("unknown session".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn scan_get_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.snapshot(&session_id).await)
}

#[tauri::command]
async fn scan_get_result(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.result_value(&session_id).await)
}

#[tauri::command]
async fn scan_get_coverage(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.coverage_value(&session_id).await)
}

#[tauri::command]
async fn scan_get_finding_detail(state: State<'_, AppState>, session_id: String, finding_id: String) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.finding_detail_value(&session_id, &finding_id).await)
}

#[tauri::command]
async fn scan_get_image_analysis(state: State<'_, AppState>, session_id: String, query: Option<serde_json::Value>) -> Result<Option<serde_json::Value>, String> {
    state.registry.image_analysis_value(&session_id, &query.unwrap_or_else(||serde_json::json!({}))).await
}

#[tauri::command]
async fn scan_get_evidence_asset(state: State<'_, AppState>, session_id: String, asset_id: String) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.evidence_asset_value(&session_id, &asset_id).await)
}

#[tauri::command]
async fn scan_get_evidence_summary(state: State<'_, AppState>, session_id: String) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.evidence_summary_value(&session_id).await)
}

#[tauri::command]
async fn scan_get_evidence_graph_slice(state: State<'_, AppState>, session_id: String, query: serde_json::Value) -> Result<Option<serde_json::Value>, String> {
    state.registry.evidence_graph_value(&session_id, &query).await
}

#[tauri::command]
async fn scan_get_extra_result(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.extra_value(&session_id).await)
}

#[tauri::command]
async fn scan_export(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    directory: String,
) -> Result<serde_json::Value, String> {
    // Cancelled sessions export only after the host retained a validated bundle.
    let Some(snapshot) = state.registry.snapshot(&session_id).await else {
        return Err("unknown session".to_string());
    };
    // Re-validate the stored bytes: a stale or tampered store must fail
    // here, never produce a submittable file.
    let canonical = state.registry.validated_export_text(&session_id).await?;
    // Ask the evaluator where to save (native dialog); an empty directory
    // string means "ask". A cancelled dialog is a clean no-op, not an error.
    if directory.trim().is_empty() || directory.trim() == "." {
        use tauri_plugin_dialog::{DialogExt, FilePath};
        let mut dlg = app
            .dialog()
            .file()
            .set_file_name("result.json")
            .add_filter("JSON", &["json"]);
        if snapshot["status"] == "cancelled" {
            dlg = dlg.set_title("중지 전 확인한 일부 결과 저장 — 전체 페이지를 확인하지 못했습니다");
        }
        // Default to the INTERACTIVE user's Documents folder. document_dir()
        // resolves for the process user (SYSTEM under the service task),
        // whose profile has no Documents redirect — the dialog then falls
        // back to System32 and forces the permission-redirect dance
        // observed on the VM (SYSTEM profile confirmed via whoami).
        let docs = app
            .path()
            .document_dir()
            .ok()
            .filter(|p| p.is_dir())
            .or_else(|| {
                std::fs::read_dir("C:\\Users").ok().and_then(|entries| {
                    entries.flatten().find_map(|e| {
                        let docs = e.path().join("Documents");
                        docs.is_dir().then_some(docs)
                    })
                })
            });
        if let Some(docs) = docs {
            dlg = dlg.set_directory(&docs);
        }
        let picked = dlg.blocking_save_file();
        let Some(FilePath::Path(path)) = picked else {
            // Dialog cancellation is a normal no-op: no file, no error, no
            // browser-download fallback. The UI keeps the validated result.
            return Ok(serde_json::json!({ "resultJson": null, "cancelled": true }));
        };
        let path = path.into_os_string();
        // Surface write failures (permission denied, missing dir) as errors
        // with no automatic fallback: a false "saved" message is worse than
        // an explicit failure the evaluator can act on.
        std::fs::write(&path, canonical.as_bytes()).map_err(|e| format!("export failed: {e}"))?;
        return Ok(serde_json::json!({
            "resultJson": path.to_string_lossy(),
        }));
    }
    let path = std::path::Path::new(directory.trim()).join("result.json");
    std::fs::write(&path, canonical.as_bytes()).map_err(|e| format!("export failed: {e}"))?;
    Ok(serde_json::json!({
        "resultJson": path.to_string_lossy(),
    }))
}

fn url_like_valid(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("entryUrl must start with http(s)://".to_string());
    }
    Ok(trimmed.to_string())
}

fn sidecar_path(app: &tauri::AppHandle) -> Option<String> {
    // The installer resource is authoritative. A portable layout keeps the
    // same JS worker beside the executable when there is no resource. It
    // retains .mjs so spawn_sidecar invokes Node rather than treating JS as PE.
    const WORKER: &str = "scanner-worker-x86_64-pc-windows-gnu.mjs";
    if let Ok(resource) = app.path()
        .resolve(format!("binaries/{WORKER}"), tauri::path::BaseDirectory::Resource)
    {
        if resource.is_file() {
            return Some(resource.to_string_lossy().to_string());
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join(WORKER);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().to_string());
            }
        }
    }
    None
}

/// Resolve a writable WebView profile dir. Order: explicit env override,
/// %LOCALAPPDATA% unless service-poisoned, first interactive C:\Users profile,
/// %ProgramData% last resort.
fn webview_data_dir() -> Option<std::path::PathBuf> {
    if let Some(dir) = std::env::var_os("WEBVIEW2_USER_DATA_FOLDER") {
        return Some(std::path::PathBuf::from(dir));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let p = std::path::PathBuf::from(&local);
        if !p.to_string_lossy().replace('/', "\\").to_lowercase().contains("system32\\config") {
            return Some(p.join("kr.go.nia.illegal-ad-detector").join("EBWebView"));
        }
    }
    if let Ok(entries) = std::fs::read_dir("C:\\Users") {
        for e in entries.flatten() {
            let p = e.path().join("AppData").join("Local");
            if p.is_dir() {
                return Some(p.join("kr.go.nia.illegal-ad-detector").join("EBWebView"));
            }
        }
    }
    std::env::var("ProgramData").ok().map(|d| {
        std::path::PathBuf::from(d).join("kr.go.nia.illegal-ad-detector").join("EBWebView")
    })
}

fn main() {
    // WebView2 profile must exist before wry creates its environment (which
    // happens before .setup()). Resolve order:
    // 1. WEBVIEW2_USER_DATA_FOLDER if already set (harness override);
    // 2. %LOCALAPPDATA% unless it points inside system32\config (service
    //    profiles such as SYSTEM/systemprofile are unwritable for WebView2);
    // 3. first interactive user profile under C:\Users with Local AppData;
    // 4. %ProgramData% as a last resort.
    // Fixes the "couldn't create the data directory" dialog on service-launched
    // processes. Real interactive launches hit branch 2 and are unaffected.
    if std::env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_none() {
        let base: Option<std::path::PathBuf> = std::env::var("LOCALAPPDATA")
            .ok()
            .map(std::path::PathBuf::from)
            .filter(|p| {
                !p.to_string_lossy().replace('/', "\\").to_lowercase().contains("system32\\config")
            })
            .or_else(|| {
                std::fs::read_dir("C:\\Users").ok().and_then(|entries| {
                    entries.flatten().find_map(|e| {
                        let p = e.path().join("AppData").join("Local");
                        p.is_dir().then_some(p)
                    })
                })
            })
            .or_else(|| std::env::var("ProgramData").ok().map(std::path::PathBuf::from));
        if let Some(base) = base {
            std::env::set_var(
                "WEBVIEW2_USER_DATA_FOLDER",
                base.join("kr.go.nia.illegal-ad-detector").join("EBWebView"),
            );
        }
    }
    let registry = SessionRegistry::shared();
    let data_dir = webview_data_dir();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState { registry })
        .setup(move |app| {
            let dir = data_dir.clone().ok_or("no writable WebView profile dir")?;
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let window: tauri::WebviewWindow = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("불법광고 탐지 도구")
            .inner_size(1200.0, 860.0)
            .prevent_overflow()
            .center()
            .zoom_hotkeys_enabled(cfg!(target_os = "windows"))
            .data_directory(dir)
            .visible(true)
            .focused(true)
            .build()
            .map_err(|e| e.to_string())?;
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            Ok(())
        })
        // Exit cleanup: dropping the registry kills owned sidecar children
        // (kill_on_drop) and releases Job Objects (kill-on-close).
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let _ = window;
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_start,
            scan_cancel,
            scan_get_session,
            scan_get_result,
            scan_get_coverage,
            scan_get_finding_detail,
            scan_get_image_analysis,
            scan_get_evidence_asset,
            scan_get_evidence_summary,
            scan_get_evidence_graph_slice,
            scan_get_extra_result,
            scan_export
        ])
        .run(tauri::generate_context!())
        .expect("tauri host failed to start");
}
