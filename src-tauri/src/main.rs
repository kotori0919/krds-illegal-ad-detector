//! Tauri 2 thin native host (GOAL Phase 18, KODEX §13).
//!
//! Responsibilities ONLY: React hosting, HostBridge IPC, scanner lifecycle,
//! filesystem export, resource paths, packaging, native dialogs, process
//! supervision, narrowly scoped Windows integration. No detection semantics
//! in commands — the scanner sidecar (Node worker bundling
//! packages/scanner + packages/detection) owns crawl + detection; this host
//! supervises it and persists its validated output.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod case_store;
mod config;
mod evidence;
#[cfg(windows)]
mod job;
#[cfg(not(windows))]
mod job_fallback;
mod report;
mod session;
mod validation;
mod warp;

use session::{load_cancelled_bundle, SessionOutcome, SessionRegistry};
use std::sync::Arc;
use tauri::{Emitter, Manager, State, WebviewWindowBuilder};
use validation::{validate_extra_bundle, validate_sidecar_stdout};

struct AppState {
    registry: Arc<SessionRegistry>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WarpRegistrationRequest {
    accept_terms: bool,
}

#[tauri::command]
fn get_warp_status(app: tauri::AppHandle) -> Result<warp::WarpStatus, String> {
    #[cfg(windows)]
    {
        warp::status(&app)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(warp::WarpStatus::Unsupported)
    }
}

#[tauri::command]
fn open_warp_terms() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::c_void;
        #[link(name = "shell32")]
        extern "system" {
            fn ShellExecuteW(
                window: *mut c_void,
                operation: *const u16,
                file: *const u16,
                parameters: *const u16,
                directory: *const u16,
                show: i32,
            ) -> *mut c_void;
        }
        let operation = b"open\0".map(u16::from);
        let url = b"https://www.cloudflare.com/application/terms/\0".map(u16::from);
        // The command accepts no caller-controlled target or arguments. ShellExecuteW
        // returns values <= 32 on failure; the browser owns the external document.
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                url.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1,
            )
        } as isize;
        if result > 32 {
            Ok(())
        } else {
            Err("WARP_TERMS_OPEN_FAILED".into())
        }
    }
    #[cfg(not(windows))]
    {
        Err("WARP_TERMS_UNSUPPORTED".into())
    }
}

#[tauri::command]
async fn register_warp(
    app: tauri::AppHandle,
    request: WarpRegistrationRequest,
) -> Result<warp::WarpStatus, String> {
    #[cfg(windows)]
    {
        warp::register(&app, request.accept_terms).await
    }
    #[cfg(not(windows))]
    {
        let _ = (app, request);
        Ok(warp::WarpStatus::Unsupported)
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct ScanLimitsArg {
    #[serde(rename = "maxPages")]
    max_pages: Option<u32>,
    #[serde(rename = "maxDepth")]
    max_depth: Option<u32>,
    #[serde(rename = "timeoutSec")]
    timeout_sec: Option<u64>,
    #[serde(rename = "maxFrameDepth")]
    max_frame_depth: Option<u32>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct ScanStartRequest {
    #[serde(rename = "configVersion")]
    config_version: u32,
    #[serde(rename = "entryUrl")]
    entry_url: String,
    limits: Option<ScanLimitsArg>,
    #[serde(default)]
    connection: warp::ScanConnection,
}

#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct BatchScanStartRequest {
    #[serde(rename = "configVersion")]
    config_version: u32,
    #[serde(rename = "entryUrl")]
    entry_url: String,
    limits: Option<ScanLimitsArg>,
    kind: String,
    #[serde(default)]
    connection: warp::ScanConnection,
}

#[cfg(test)]
mod scan_request_tests {
    use super::*;

    #[test]
    fn connection_is_optional_direct_and_validated_for_single_and_batch_requests() {
        let mut value = serde_json::json!({"configVersion":1,"entryUrl":"https://example.kr/"});
        assert_eq!(
            serde_json::from_value::<ScanStartRequest>(value.clone())
                .unwrap()
                .connection,
            warp::ScanConnection::Direct
        );
        value["connection"] = serde_json::json!("warp");
        assert_eq!(
            serde_json::from_value::<ScanStartRequest>(value.clone())
                .unwrap()
                .connection,
            warp::ScanConnection::Warp
        );
        value["kind"] = serde_json::json!("site");
        assert_eq!(
            serde_json::from_value::<BatchScanStartRequest>(value.clone())
                .unwrap()
                .connection,
            warp::ScanConnection::Warp
        );
        value.as_object_mut().unwrap().remove("connection");
        assert_eq!(
            serde_json::from_value::<BatchScanStartRequest>(value.clone())
                .unwrap()
                .connection,
            warp::ScanConnection::Direct
        );
        for connection in [
            serde_json::json!("automatic"),
            serde_json::json!(null),
            serde_json::json!({}),
        ] {
            value["connection"] = connection;
            assert!(serde_json::from_value::<BatchScanStartRequest>(value.clone()).is_err());
            value.as_object_mut().unwrap().remove("kind");
            assert!(serde_json::from_value::<ScanStartRequest>(value.clone()).is_err());
            value["kind"] = serde_json::json!("site");
        }
    }
}

#[cfg(test)]
mod url_validation_tests {
    use super::url_like_valid;

    #[test]
    fn accepts_http_and_https_and_trims_surrounding_whitespace() {
        assert_eq!(
            url_like_valid("https://example.com/").unwrap(),
            "https://example.com/"
        );
        assert_eq!(
            url_like_valid("http://example.kr/path?q=1").unwrap(),
            "http://example.kr/path?q=1"
        );
        assert_eq!(
            url_like_valid("  https://example.com/  ").unwrap(),
            "https://example.com/"
        );
        assert_eq!(
            url_like_valid("\n\thttps://example.com/\t\n").unwrap(),
            "https://example.com/"
        );
    }

    #[test]
    fn rejects_non_http_schemes() {
        assert_eq!(
            url_like_valid("ftp://example.com/file").unwrap_err(),
            "entryUrl must start with http(s)://"
        );
    }

    #[test]
    fn rejects_credential_urls() {
        assert_eq!(
            url_like_valid("https://user:pass@example.com/").unwrap_err(),
            "entryUrl must not contain credentials"
        );
        assert_eq!(
            url_like_valid("https://user@example.com/").unwrap_err(),
            "entryUrl must not contain credentials"
        );
    }

    #[test]
    fn rejects_missing_or_empty_authority() {
        assert_eq!(
            url_like_valid("https:///nohost").unwrap_err(),
            "entryUrl must include a host"
        );
        assert!(url_like_valid("https://").is_err());
        assert_eq!(
            url_like_valid("not a url").unwrap_err(),
            "entryUrl must be an absolute http(s) URL"
        );
    }
}

#[tauri::command]
async fn scan_start(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: ScanStartRequest,
) -> Result<serde_json::Value, String> {
    start_scan(app, state, request, false, "site").await
}

#[tauri::command]
async fn scan_start_batch(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: BatchScanStartRequest,
) -> Result<serde_json::Value, String> {
    if request.kind != "site" && request.kind != "sitemap" {
        return Err("invalid imported target kind".to_string());
    }
    start_scan(
        app,
        state,
        ScanStartRequest {
            config_version: request.config_version,
            entry_url: request.entry_url,
            limits: request.limits,
            connection: request.connection,
        },
        true,
        &request.kind,
    )
    .await
}

async fn start_scan(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: ScanStartRequest,
    public_network_only: bool,
    entry_kind: &str,
) -> Result<serde_json::Value, String> {
    if request.config_version != 1 {
        return Err("unsupported scan configVersion".into());
    }
    if request.entry_url.trim().is_empty() {
        return Err("entryUrl is required".to_string());
    }
    let parsed = url_like_valid(&request.entry_url)?;
    let none_limits = ScanLimitsArg {
        max_pages: None,
        max_depth: None,
        timeout_sec: None,
        max_frame_depth: None,
    };
    let limits = request.limits.as_ref().unwrap_or(&none_limits);
    let max_pages = config::scan_limit(limits.max_pages.map(u64::from), "maxPages")?;
    let max_depth = config::scan_limit(limits.max_depth.map(u64::from), "maxDepth")?;
    let timeout_sec = config::scan_limit(limits.timeout_sec, "timeoutSec")?;
    let max_frame_depth =
        config::scan_limit(limits.max_frame_depth.map(u64::from), "maxFrameDepth")?;
    // Resolve optional WARP resources before creating a running session. Direct
    // scans must not inspect registration, configuration, or bundled WARP files.
    let transport_args = request.connection.worker_args(|| {
        #[cfg(windows)]
        {
            warp::worker_paths(&app)
        }
        #[cfg(not(windows))]
        {
            Err("WARP_UNSUPPORTED".into())
        }
    })?;
    let started_at = chrono::Utc::now().to_rfc3339();
    let mut record = session::new_session(parsed.clone(), started_at.clone());
    let build = app
        .path()
        .resource_dir()
        .ok()
        .and_then(|dir| std::fs::read(dir.join("binaries/build-manifest.json")).ok())
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
    record.settings = serde_json::json!({"version":1,"policy":config::policy(),"maxPages":max_pages,"maxDepth":max_depth,"timeoutSec":timeout_sec,"concurrency":config::policy()["scan"]["concurrency"]["default"],"maxFrameDepth":max_frame_depth,"network":if public_network_only{"public-pinned"}else{"manual-entry-origin-pinned"},"entryKind":entry_kind,"build":build.map(|b|serde_json::json!({"sourceCommit":b["source"]["commit"],"sourceSha256":b["source"]["sourceSha256"],"target":b["target"],"appVersion":b["appVersion"]})),"hostStartedAt":started_at,"connection":request.connection});
    let session_id = record.id.clone();
    state.registry.insert(record).await;
    // Bundled worker script (resources/binaries/scanner-worker*.mjs). No silent
    // heartbeat: if the sidecar is absent the session must fail loudly
    // instead of freezing the UI on zero counters.
    let Some(path) = sidecar_path(&app) else {
        let detail = "scanner worker script not found in the app resources".to_string();
        state
            .registry
            .fail(&session_id, detail.clone(), chrono::Utc::now().to_rfc3339())
            .await;
        return Err(detail);
    };
    {
        let mut args: Vec<String> = vec![
            "--session".to_string(),
            session_id.clone(),
            "--entry-url".to_string(),
            parsed.clone(),
            "--max-pages".to_string(),
            max_pages.to_string(),
            "--max-depth".to_string(),
            max_depth.to_string(),
            "--max-frame-depth".to_string(),
            max_frame_depth.to_string(),
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
        if public_network_only {
            args.push("--public-network-only".to_string());
        }
        args.extend(["--entry-kind".to_string(), entry_kind.to_string()]);
        args.extend(transport_args);
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        if let Err(detail) = state
            .registry
            .spawn_sidecar(&session_id, &path, &arg_refs)
            .await
        {
            state
                .registry
                .fail(&session_id, detail.clone(), chrono::Utc::now().to_rfc3339())
                .await;
            return Err(format!(
                "scanner sidecar failed to start ({path}): {detail}"
            ));
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
            let outcome = registry
                .wait_sidecar_with_watchdog(&finished_session, sink, timeout_sec)
                .await;
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
    state
        .registry
        .snapshot(&session_id)
        .await
        .ok_or_else(|| "unknown session".to_string())
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
            registry
                .store_result(
                    session_id,
                    stdout,
                    std::fs::read_to_string(&detail_path).unwrap_or_default(),
                    std::fs::read_to_string(&extra_path).unwrap_or_default(),
                    finished_at.clone(),
                )
                .await;
        }
        SessionOutcome::Failed { detail } => {
            // Keep validated output. The registry commits typed WARP failures as
            // failed/incomplete atomically; optional-write failures retain success.
            let retained = std::fs::read_to_string(&result_path)
                .ok()
                .filter(|text| validate_sidecar_stdout(entry_url, text).is_ok());
            if let Some(official) = retained {
                registry
                    .store_result(
                        session_id,
                        official,
                        std::fs::read_to_string(&detail_path).unwrap_or_default(),
                        std::fs::read_to_string(&extra_path).unwrap_or_default(),
                        finished_at.clone(),
                    )
                    .await;
            } else {
                registry.fail(session_id, detail, finished_at.clone()).await;
            }
        }
        SessionOutcome::Cancelled => {}
    }
    // Cancellation accepted before the atomic artifact commit wins over completion.
    if registry.cancellation_requested(session_id).await {
        let retained = load_cancelled_bundle(entry_url, &result_path, &detail_path, &extra_path);
        let (bundle, error) = match retained {
            Ok(bundle) => (Some(bundle), None),
            Err(error) => (None, Some(error)),
        };
        registry
            .complete_cancellation(session_id, bundle, error, finished_at.clone())
            .await;
    }
    let Some(snapshot) = registry.snapshot(session_id).await else {
        return;
    };
    let status = snapshot["status"].as_str().unwrap_or("failed");
    let (kind, message) = match status {
        "succeeded" => ("session-finished", "탐지가 완료되었습니다."),
        "cancelled" if snapshot["hasResult"] == true => {
            ("session-cancelled", "중지 전 확인한 결과가 저장되었습니다.")
        }
        "cancelled" => (
            "session-cancelled",
            "점검이 중지되었습니다. 저장된 결과가 없습니다.",
        ),
        _ => (
            "session-failed",
            snapshot["error"]
                .as_str()
                .unwrap_or("점검을 완료하지 못했습니다."),
        ),
    };
    // On a persistence failure retain the worker's only validated output for recovery.
    if snapshot["hasResult"] == true {
        let _ = std::fs::remove_file(detail_path);
        let _ = std::fs::remove_file(extra_path);
        let _ = std::fs::remove_file(result_path);
    }
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
async fn scan_cancel(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let finished_at = chrono::Utc::now().to_rfc3339();
    if !state
        .registry
        .cancel(&session_id, finished_at.clone())
        .await
    {
        return Err("unknown session".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn case_list(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.registry.case_store()?.list()
}

#[tauri::command]
async fn case_open(
    state: State<'_, AppState>,
    case_id: String,
) -> Result<serde_json::Value, String> {
    state.registry.open_case(&case_id).await
}

#[tauri::command]
async fn case_save_review(
    state: State<'_, AppState>,
    case_id: String,
    expected_revision: u64,
    records: Vec<case_store::ReviewRecord>,
) -> Result<case_store::CaseReview, String> {
    state
        .registry
        .case_store()?
        .save_review(&case_id, expected_revision, records)
}

#[tauri::command]
async fn case_export(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    case_id: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let Some(FilePath::Path(directory)) = app
        .dialog()
        .file()
        .set_title("케이스 전달 폴더 선택")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    state
        .registry
        .case_store()?
        .export_directory(&case_id, &directory)
        .map(|p| Some(p.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn case_import(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let Some(FilePath::Path(directory)) = app
        .dialog()
        .file()
        .set_title("전달받은 case 폴더 선택")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    state.registry.import_case(&directory).await.map(Some)
}

#[tauri::command]
async fn case_delete(state: State<'_, AppState>, case_id: String) -> Result<(), String> {
    state.registry.delete_case(&case_id).await
}

#[tauri::command]
async fn support_diagnostics(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    Ok(
        serde_json::json!({"toolVersion":env!("CARGO_PKG_VERSION"),"policyVersion":2,"caseSchema":1,"storageRoot":state.registry.case_store()?.root(),"network":"batch-public-pinned/single-evaluator","model":"disabled","signing":"unsigned-internal"}),
    )
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
async fn scan_get_finding_detail(
    state: State<'_, AppState>,
    session_id: String,
    finding_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state
        .registry
        .finding_detail_value(&session_id, &finding_id)
        .await)
}

#[tauri::command]
async fn scan_get_image_analysis(
    state: State<'_, AppState>,
    session_id: String,
    query: Option<serde_json::Value>,
) -> Result<Option<serde_json::Value>, String> {
    state
        .registry
        .image_analysis_value(&session_id, &query.unwrap_or_else(|| serde_json::json!({})))
        .await
}

#[tauri::command]
async fn scan_get_evidence_asset(
    state: State<'_, AppState>,
    session_id: String,
    asset_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state
        .registry
        .evidence_asset_value(&session_id, &asset_id)
        .await)
}

#[tauri::command]
async fn scan_get_evidence_summary(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.evidence_summary_value(&session_id).await)
}

#[tauri::command]
async fn scan_get_evidence_graph_slice(
    state: State<'_, AppState>,
    session_id: String,
    query: serde_json::Value,
) -> Result<Option<serde_json::Value>, String> {
    state
        .registry
        .evidence_graph_value(&session_id, &query)
        .await
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
        if snapshot["status"] == "cancelled" || snapshot["status"] == "failed" {
            dlg = dlg.set_title("확인한 일부 결과 저장 — 전체 페이지를 확인하지 못했습니다");
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

#[tauri::command]
async fn scan_export_workbook(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_ids: Vec<String>,
    data: Vec<u8>,
) -> Result<Option<String>, String> {
    if session_ids.is_empty() || session_ids.len() > 100 {
        return Err("invalid report session scope".to_string());
    }
    report::validate_workbook(&data)?;
    for id in &session_ids {
        // A report cannot claim to represent a missing/unvalidated official session.
        state.registry.validated_export_text(id).await?;
    }
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let name = if session_ids.len() == 1 {
        "점검 보고서.xlsx"
    } else {
        "일괄 점검 보고서.xlsx"
    };
    let mut dialog = app
        .dialog()
        .file()
        .set_file_name(name)
        .add_filter("Excel 보고서", &["xlsx"]);
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(FilePath::Path(mut path)) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    // Never let a report overwrite a .json export chosen in the dialog.
    path.set_extension("xlsx");
    report::write_workbook(&path, &data)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn scan_export_batch(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_ids: Vec<String>,
) -> Result<Option<String>, String> {
    if session_ids.is_empty() || session_ids.len() > 100 {
        return Err("invalid batch export scope".to_string());
    }
    let mut bundles = Vec::with_capacity(session_ids.len());
    for id in &session_ids {
        let official = state.registry.validated_export_text(id).await?;
        let extra = state.registry.extra_value(id).await;
        if let Some(value) = &extra {
            validate_extra_bundle(&official, &value.to_string())?;
        }
        let coverage = state.registry.coverage_value(id).await;
        let snapshot = state
            .registry
            .snapshot(id)
            .await
            .ok_or("unknown batch session")?;
        bundles.push((official, extra, coverage, snapshot));
    }
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let Some(FilePath::Path(parent)) = app
        .dialog()
        .file()
        .set_title("사이트별 공식 결과를 저장할 폴더 선택")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let root = parent.join(format!("krds-batch-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).map_err(|e| format!("batch directory failed: {e}"))?;
    let mut manifest = Vec::new();
    for (index, (official, extra, coverage, snapshot)) in bundles.into_iter().enumerate() {
        let name = format!("target-{:03}", index + 1);
        let dir = root.join(&name);
        std::fs::create_dir(&dir).map_err(|e| format!("batch target directory failed: {e}"))?;
        std::fs::write(dir.join("result.json"), official)
            .map_err(|e| format!("batch official write failed: {e}"))?;
        if let Some(value) = extra {
            std::fs::write(dir.join("result_extra.json"), value.to_string())
                .map_err(|e| format!("batch extra write failed: {e}"))?;
        }
        if let Some(value) = coverage {
            std::fs::write(dir.join("coverage.json"), value.to_string())
                .map_err(|e| format!("batch coverage write failed: {e}"))?;
        }
        manifest.push(serde_json::json!({ "directory": name, "session": snapshot }));
    }
    std::fs::write(
        root.join("batch.json"),
        serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("batch manifest write failed: {e}"))?;
    Ok(Some(root.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn scan_save_template(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let Some(FilePath::Path(mut path)) = app
        .dialog()
        .file()
        .set_file_name("점검 대상 양식.csv")
        .add_filter("CSV", &["csv"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    path.set_extension("csv");
    std::fs::write(
        &path,
        "\u{feff}사이트명,시작 주소\r\n예시 사이트,https://example.kr/\r\n",
    )
    .map_err(|e| format!("template write failed: {e}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn url_like_valid(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let parsed = tauri::Url::parse(trimmed)
        .map_err(|_| "entryUrl must be an absolute http(s) URL".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("entryUrl must start with http(s)://".to_string());
    }
    // Credentials would be copied into the sidecar argv and session settings
    // before the worker rejects them, exposing the secret to local inspection.
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("entryUrl must not contain credentials".to_string());
    }
    // The WHATWG parser folds `https:///host` into `https://host/`, so require
    // an explicit authority rather than trusting the normalized host.
    let authority = trimmed[parsed.scheme().len()..]
        .strip_prefix("://")
        .ok_or_else(|| "entryUrl must start with http(s)://".to_string())?;
    if authority.is_empty() || authority.starts_with('/') {
        return Err("entryUrl must include a host".to_string());
    }
    match parsed.host_str() {
        Some(host) if !host.is_empty() => Ok(trimmed.to_string()),
        _ => Err("entryUrl must include a host".to_string()),
    }
}

fn sidecar_path(app: &tauri::AppHandle) -> Option<String> {
    // The installer resource is authoritative. A portable layout keeps the
    // same JS worker beside the executable when there is no resource. It
    // retains .mjs so spawn_sidecar invokes Node rather than treating JS as PE.
    const WORKER: &str = "scanner-worker-x86_64-pc-windows-gnu.mjs";
    if let Ok(resource) = app.path().resolve(
        format!("binaries/{WORKER}"),
        tauri::path::BaseDirectory::Resource,
    ) {
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
        if !p
            .to_string_lossy()
            .replace('/', "\\")
            .to_lowercase()
            .contains("system32\\config")
        {
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
        std::path::PathBuf::from(d)
            .join("kr.go.nia.illegal-ad-detector")
            .join("EBWebView")
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
                !p.to_string_lossy()
                    .replace('/', "\\")
                    .to_lowercase()
                    .contains("system32\\config")
            })
            .or_else(|| {
                std::fs::read_dir("C:\\Users").ok().and_then(|entries| {
                    entries.flatten().find_map(|e| {
                        let p = e.path().join("AppData").join("Local");
                        p.is_dir().then_some(p)
                    })
                })
            })
            .or_else(|| {
                std::env::var("ProgramData")
                    .ok()
                    .map(std::path::PathBuf::from)
            });
        if let Some(base) = base {
            std::env::set_var(
                "WEBVIEW2_USER_DATA_FOLDER",
                base.join("kr.go.nia.illegal-ad-detector").join("EBWebView"),
            );
        }
    }
    let data_dir = webview_data_dir();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            let cases = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
                .join("cases");
            app.manage(AppState {
                registry: SessionRegistry::persistent(cases)?,
            });
            app.manage(warp::Registration::default());
            let dir = data_dir.clone().ok_or("no writable WebView profile dir")?;
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let window: tauri::WebviewWindow =
                WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                    .title("불법광고 탐지 도구")
                    .inner_size(1200.0, 860.0)
                    .prevent_overflow()
                    .center()
                    .zoom_hotkeys_enabled(cfg!(target_os = "windows"))
                    .disable_drag_drop_handler()
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
            get_warp_status,
            open_warp_terms,
            register_warp,
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
            scan_export,
            scan_export_workbook,
            scan_start_batch,
            scan_export_batch,
            scan_save_template,
            case_list,
            case_open,
            case_save_review,
            case_export,
            case_import,
            case_delete,
            support_diagnostics
        ])
        .run(tauri::generate_context!())
        .expect("tauri host failed to start");
}
