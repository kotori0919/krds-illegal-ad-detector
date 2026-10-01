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

use session::{new_session, SessionRegistry, SessionStatus};
use std::sync::Arc;
use tauri::{Emitter, Manager, State};

struct AppState {
    registry: Arc<SessionRegistry>,
}

#[derive(Debug, serde::Deserialize)]
struct ScanStartRequest {
    #[serde(rename = "entryUrl")]
    entry_url: String,
    topic: Option<String>,
    limits: Option<serde_json::Value>,
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
    let started_at = chrono::Utc::now().to_rfc3339();
    let record = new_session(
        parsed,
        request.topic.unwrap_or_default(),
        started_at.clone(),
    );
    let session_id = record.id.clone();
    state.registry.insert(record).await;
    // Resolve the bundled sidecar; dev falls back to a no-op heartbeat so
    // the UI flow exercises without a packaged worker.
    let sidecar_path = sidecar_path(&app);
    if let Some(path) = sidecar_path {
        let args: Vec<String> = vec![
            "--session".to_string(),
            session_id.clone(),
        ];
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        let _pid = state
            .registry
            .spawn_sidecar(&session_id, &path, &arg_refs)
            .await?;
    }
    let _ = request.limits;
    app.emit("scan-event", serde_json::json!({
        "kind": "session-started",
        "sessionId": session_id,
        "at": started_at,
        "progress": {"visitedPages": 0, "queuedPages": 0, "framesInspected": 0, "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": 0, "elapsedSec": 0, "stage": "crawling"},
        "pageUrl": request.entry_url,
    }))
    .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "id": session_id,
        "entryUrl": request.entry_url,
        "topic": "",
        "status": SessionStatus::Crawling.as_str(),
        "startedAt": started_at,
    }))
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
    app.emit("scan-event", serde_json::json!({
        "kind": "session-cancelled",
        "sessionId": session_id,
        "at": finished_at,
        "progress": {"visitedPages": 0, "queuedPages": 0, "framesInspected": 0, "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": 0, "elapsedSec": 0, "stage": "cancelled"},
    }))
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn scan_get_session(
    _state: State<'_, AppState>,
    _session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    // Sessions are tracked in the registry; full read-back ships with the
    // sidecar result-store slice. Unknown ids return None (no throw).
    Ok(None)
}

#[tauri::command]
async fn scan_get_result(
    _state: State<'_, AppState>,
    _session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(None)
}

#[tauri::command]
async fn scan_get_extra_result(
    _state: State<'_, AppState>,
    _session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(None)
}

#[tauri::command]
async fn scan_export(
    _app: tauri::AppHandle,
    _session_id: String,
    directory: String,
) -> Result<serde_json::Value, String> {
    if directory.trim().is_empty() {
        return Err("directory is required".to_string());
    }
    Err("no result stored for session yet (sidecar result-store slice)".to_string())
}

fn url_like_valid(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("entryUrl must start with http(s)://".to_string());
    }
    Ok(trimmed.to_string())
}

fn sidecar_path(app: &tauri::AppHandle) -> Option<String> {
    app.path()
        .resolve(
            "binaries/scanner-worker",
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

fn main() {
    // WebView2 profile must exist before wry creates its environment (which
    // happens before .setup()). Default to %LOCALAPPDATA% so service-like
    // profiles never poison the path. Overridable via env for harnesses.
    if std::env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_none() {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            std::env::set_var(
                "WEBVIEW2_USER_DATA_FOLDER",
                std::path::Path::new(&local).join("kr.go.nia.illegal-ad-detector").join("EBWebView"),
            );
        }
    }
    let registry = SessionRegistry::shared();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState { registry })
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
            scan_get_extra_result,
            scan_export
        ])
        .run(tauri::generate_context!())
        .expect("tauri host failed to start");
}
