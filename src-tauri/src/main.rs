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

use session::{SessionOutcome, SessionRegistry, SessionStatus};
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
    topic: Option<String>,
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
    if timeout_sec < 60 || timeout_sec > 1750 {
        return Err("timeoutSec must be 60..=1750".to_string());
    }
    let topic = request.topic.clone().unwrap_or_default();
    let started_at = chrono::Utc::now().to_rfc3339();
    let record = session::new_session(parsed.clone(), topic.clone(), started_at.clone());
    let session_id = record.id.clone();
    state.registry.insert(record).await;
    // Bundled sidecar (resources/binaries/scanner-worker*). No silent
    // heartbeat: if the sidecar is absent the session must fail loudly
    // instead of freezing the UI on zero counters.
    let Some(path) = sidecar_path(&app) else {
        let detail = "scanner sidecar not found (binaries/scanner-worker missing from bundle)".to_string();
        state.registry.fail(&session_id, detail.clone(), chrono::Utc::now().to_rfc3339()).await;
        return Err(detail);
    };
    {
        let args: Vec<String> = vec![
            "--session".to_string(),
            session_id.clone(),
            "--entry-url".to_string(),
            parsed.clone(),
            "--topic".to_string(),
            topic.clone(),
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
            "progress": {"visitedPages": 0, "queuedPages": 0, "framesInspected": 0, "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": 0, "elapsedSec": 0, "stage": "crawling"},
            "pageUrl": parsed,
        }),
    )
    .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "id": session_id,
        "entryUrl": parsed,
        "topic": topic,
        "status": SessionStatus::Crawling.as_str(),
        "startedAt": started_at,
    }))
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
    let (kind, status, message): (String, String, String) = match outcome {
        SessionOutcome::Succeeded { stdout } => {
            let detail_path = std::env::temp_dir().join(format!("krds-detail-{session_id}.json"));
            let detail_text = std::fs::read_to_string(&detail_path).map_err(|e| format!("detail manifest missing: {e}"));
            let _ = std::fs::remove_file(&detail_path);
            let validated = validate_sidecar_stdout(entry_url, &stdout).and_then(|canonical| {
                let detail = detail_text?;
                validate_detail_bundle(&canonical, &detail)?;
                Ok((canonical, detail))
            });
            match validated {
                Ok((canonical, detail)) => {
                    registry.store_result(session_id, canonical, detail, finished_at.clone()).await;
                    ("session-finished".into(), "succeeded".into(), "탐지가 완료되었습니다.".into())
                }
                Err(detail) => {
                    registry.fail(session_id, detail.clone(), finished_at.clone()).await;
                    ("session-failed".into(), "failed".into(), detail)
                }
            }
        },
        SessionOutcome::Failed { detail } => {
            registry.fail(session_id, detail.clone(), finished_at.clone()).await;
            ("session-failed".into(), "failed".into(), detail)
        }
        // Cancel already emitted session-cancelled synchronously; stay silent.
        SessionOutcome::Cancelled => return,
    };
    let progress = registry.progress_snapshot(session_id).await;
    let _ = app.emit(
        "scan-event",
        serde_json::json!({
            "kind": kind,
            "sessionId": session_id,
            "at": finished_at,
            "progress": {"visitedPages": progress.pages, "queuedPages": 0, "framesInspected": 0, "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": progress.findings, "elapsedSec": 0, "stage": status},
            "message": message,
            "pageUrl": entry_url,
        }),
    );
}

#[cfg(test)]
mod validation_tests {
    use super::{validate_detail_bundle, validate_sidecar_stdout};

    fn good_json() -> String {
        "{\"meta\":{\"topic\":\"t\",\"entry_url\":\"https://example.kr/\",\"started_at\":\"2026-10-01T00:00:00Z\",\"finished_at\":\"2026-10-01T00:01:00Z\",\"elapsed_sec\":60,\"tool_version\":\"0.1.0\"},\"findings\":[{\"id\":\"f1\",\"url\":\"https://example.kr/a\",\"is_violation\":true,\"location\":\"#a\",\"evidence_text\":\"x\",\"technique\":\"HOMOGLYPH\"}]}".to_string()
    }

    #[test]
    fn accepts_valid_result() {
        assert!(validate_sidecar_stdout("https://example.kr/", &good_json()).is_ok());
    }

    #[test]
    fn rejects_missing_meta_field() {
        let bad = good_json().replace("\"elapsed_sec\":60,", "");
        assert!(validate_sidecar_stdout("https://example.kr/", &bad).is_err());
    }

    #[test]
    fn rejects_invalid_technique() {
        let bad = good_json().replace("HOMOGLYPH", "ETC");
        let err = validate_sidecar_stdout("https://example.kr/", &bad).unwrap_err();
        assert!(err.contains("technique"), "{err}");
    }

    #[test]
    fn rejects_entry_url_mismatch() {
        let err = validate_sidecar_stdout("https://other.kr/", &good_json()).unwrap_err();
        assert!(err.contains("mismatch"), "{err}");
    }

    #[test]
    fn rejects_duplicate_identity() {
        let v: serde_json::Value = serde_json::from_str(&good_json()).unwrap();
        let mut dup = v.clone();
        let second = v["findings"][0].clone();
        let mut with_id = second.clone();
        with_id["id"] = serde_json::Value::String("f2".to_string());
        dup["findings"].as_array_mut().unwrap().push(with_id);
        let text = serde_json::to_string(&dup).unwrap();
        let err = validate_sidecar_stdout("https://example.kr/", &text).unwrap_err();
        assert!(err.contains("duplicates"), "{err}");
    }

    #[test]
    fn rejects_bom() {
        let bad = format!("\u{FEFF}{}", good_json());
        assert!(validate_sidecar_stdout("https://example.kr/", &bad).is_err());
    }

    #[test]
    fn detail_manifest_must_join_the_official_finding() {
        let detail = serde_json::json!({
            "version": 2,
            "findings": [{"findingId":"f1", "url":"https://example.kr/a", "location":"#a",
                "technique":"HOMOGLYPH", "rawText":"x", "visual":{"state":"unavailable","reason":"budget"}}],
            "coverage": {"checkedPages":1,"failedPages":[],"timedOut":false}
        });
        assert!(validate_detail_bundle(&good_json(), &detail.to_string()).is_ok());
        let mut wrong = detail;
        wrong["findings"][0]["location"] = serde_json::Value::String("#other".to_string());
        assert!(validate_detail_bundle(&good_json(), &wrong.to_string()).is_err());
    }
}

/// BOM-free UTF-8, valid JSON, complete meta, required finding fields,
/// official technique enum only, unique ids, no duplicate
/// url+location+technique identities, and request/result entry_url match.
/// Any violation fails the session and is never exportable (KODEX §38).
fn validate_sidecar_stdout(entry_url: &str, stdout: &str) -> Result<String, String> {
    if stdout.starts_with('\u{FEFF}') {
        return Err("sidecar result contained a BOM".to_string());
    }
    let parsed: serde_json::Value =
        serde_json::from_str(stdout).map_err(|e| format!("sidecar result is not JSON: {e}"))?;
    let meta = parsed.get("meta").ok_or("sidecar result missing meta")?;
    for field in ["topic", "entry_url", "started_at", "finished_at", "elapsed_sec", "tool_version"] {
        if meta.get(field).is_none() {
            return Err(format!("sidecar result meta.{field} is required"));
        }
    }
    let result_url = meta.get("entry_url").and_then(|u| u.as_str()).unwrap_or("");
    if result_url.is_empty() {
        return Err("sidecar result meta.entry_url must be a non-empty string".to_string());
    }
    if result_url != entry_url {
        return Err(format!("sidecar result entry_url mismatch: request {entry_url} vs result {result_url}"));
    }
    let findings = parsed.get("findings").and_then(|f| f.as_array()).ok_or("sidecar result findings must be an array")?;
    let mut ids = std::collections::HashSet::new();
    let mut identities = std::collections::HashSet::new();
    for (i, item) in findings.iter().enumerate() {
        let at = format!("findings[{i}]");
        for field in ["id", "url", "is_violation", "location", "evidence_text", "technique"] {
            if item.get(field).is_none() {
                return Err(format!("sidecar result {at}.{field} is required"));
            }
        }
        let id = item.get("id").and_then(|v| v.as_str()).ok_or(format!("sidecar result {at}.id must be a string"))?;
        if !ids.insert(id.to_string()) {
            return Err(format!("sidecar result {at}.id is duplicated"));
        }
        let technique = item.get("technique").and_then(|v| v.as_str()).unwrap_or("");
        if !matches!(technique, "HOMOGLYPH" | "JAMO" | "TRANSPARENT" | "OFFSCREEN") {
            return Err(format!("sidecar result {at}.technique must be one of HOMOGLYPH, JAMO, TRANSPARENT, OFFSCREEN"));
        }
        let url = item.get("url").and_then(|v| v.as_str()).unwrap_or("");
        let location = item.get("location").and_then(|v| v.as_str()).unwrap_or("");
        if location.trim().is_empty() {
            return Err(format!("sidecar result {at}.location must be non-empty"));
        }
        let key = format!("{url}\u{0}{location}\u{0}{technique}");
        if !identities.insert(key) {
            return Err(format!("sidecar result {at} duplicates url+location+technique"));
        }
    }
    let canonical = serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("sidecar result not serializable: {e}"))?;
    if canonical.starts_with('\u{FEFF}') {
        return Err("canonical serializer emitted a BOM".to_string());
    }
    Ok(format!("{canonical}\n"))
}

/// Bind every internal detail to a validated official finding. Visual bytes
/// remain in the session-local manifest and never enter result.json.
fn validate_detail_bundle(official_text: &str, detail_text: &str) -> Result<(), String> {
    if detail_text.len() > 8_000_000 { return Err("detail manifest exceeds size limit".to_string()); }
    let official: serde_json::Value = serde_json::from_str(official_text).map_err(|e| e.to_string())?;
    let detail: serde_json::Value = serde_json::from_str(detail_text).map_err(|e| format!("detail manifest invalid JSON: {e}"))?;
    if detail.get("version").and_then(|v| v.as_u64()) != Some(2) {
        return Err("detail manifest version must be 2".to_string());
    }
    let expected = official["findings"].as_array().ok_or("official findings missing")?;
    let actual = detail["findings"].as_array().ok_or("detail findings missing")?;
    if expected.len() != actual.len() { return Err("detail finding count mismatch".to_string()); }
    for finding in expected {
        let id = finding["id"].as_str().ok_or("official finding id missing")?;
        let item = actual.iter().find(|item| item["findingId"].as_str() == Some(id))
            .ok_or(format!("detail missing official finding {id}"))?;
        for (source, target) in [("url", "url"), ("location", "location"), ("technique", "technique"), ("evidence_text", "rawText")] {
            if finding[source] != item[target] { return Err(format!("detail {id} {target} mismatch")); }
        }
        let visual = &item["visual"];
        match visual["state"].as_str() {
            Some("available") => {
                let uri = visual["dataUrl"].as_str().ok_or(format!("detail {id} visual data missing"))?;
                if !uri.starts_with("data:image/jpeg;base64,") || uri.len() > 700_000 {
                    return Err(format!("detail {id} visual data invalid"));
                }
            }
            Some("unavailable") => {
                if visual.get("dataUrl").is_some() { return Err(format!("detail {id} unavailable visual has data")); }
            }
            _ => return Err(format!("detail {id} visual state invalid")),
        }
    }
    let coverage = detail.get("coverage").ok_or("detail coverage missing")?;
    let checked = coverage["checkedPages"].as_u64().ok_or("detail checkedPages missing")?;
    let failed = coverage["failedPages"].as_array().ok_or("detail failedPages missing")?;
    if failed.len() as u64 > checked { return Err("detail failedPages exceeds checkedPages".to_string()); }
    Ok(())
}

#[tauri::command]
async fn scan_cancel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let finished_at = chrono::Utc::now().to_rfc3339();
    if !state.registry.cancel(&session_id, finished_at.clone()).await {
        return Err("unknown session".to_string());
    }
    app.emit(
        "scan-event",
        serde_json::json!({
            "kind": "session-cancelled",
            "sessionId": session_id,
            "at": finished_at,
            "progress": {"visitedPages": 0, "queuedPages": 0, "framesInspected": 0, "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": 0, "elapsedSec": 0, "stage": "cancelled"},
        }),
    )
    .map_err(|e| e.to_string())?;
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
async fn scan_get_detail_bundle(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(state.registry.detail_value(&session_id).await)
}

#[tauri::command]
async fn scan_get_extra_result(
    _state: State<'_, AppState>,
    _session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    // Extra intel ships after the official path proves itself; explicit None.
    Ok(None)
}

#[tauri::command]
async fn scan_export(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    directory: String,
) -> Result<serde_json::Value, String> {
    // Only succeeded sessions export: failed/cancelled/running results
    // must never become a submittable file.
    let Some(snapshot) = state.registry.snapshot(&session_id).await else {
        return Err("unknown session".to_string());
    };
    if snapshot.get("status").and_then(|s| s.as_str()) != Some("succeeded") {
        return Err("no succeeded result stored for session yet".to_string());
    }
    let Some(text) = state.registry.result_text(&session_id).await else {
        return Err("no result stored for session yet".to_string());
    };
    // Re-validate the stored bytes: a stale or tampered store must fail
    // here, never produce a submittable file.
    let canonical = validate_sidecar_stdout(
        snapshot.get("entryUrl").and_then(|u| u.as_str()).unwrap_or(""),
        &text,
    )
    .map_err(|e| format!("stored result invalid, export blocked: {e}"))?;
    // Ask the evaluator where to save (native dialog); an empty directory
    // string means "ask". A cancelled dialog is a clean no-op, not an error.
    if directory.trim().is_empty() || directory.trim() == "." {
        use tauri_plugin_dialog::{DialogExt, FilePath};
        let mut dlg = app
            .dialog()
            .file()
            .set_file_name("result.json")
            .add_filter("JSON", &["json"]);
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
    // Tauri externalBin stages `binaries/scanner-worker-<triple>(.exe)`
    // next to the application executable. Resolve there first so the
    // installed location always matches the runtime lookup — no drift
    // between `tauri.conf.json` staging and this resolver.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // Prefer the .mjs bundle: the staged exe-named file is the
            // esbuild JS bundle, not executable (os error 216 OBSERVED).
            for name in [
                "scanner-worker-x86_64-pc-windows-gnu.mjs",
                "scanner-worker-x86_64-pc-windows-gnu.exe",
                "scanner-worker.exe",
            ] {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }
    }
    app.path()
        .resolve(
            "binaries/scanner-worker",
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .map(|p| p.to_string_lossy().to_string())
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
            scan_get_detail_bundle,
            scan_get_extra_result,
            scan_export
        ])
        .run(tauri::generate_context!())
        .expect("tauri host failed to start");
}
