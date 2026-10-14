//! Session registry: owns scanner-sidecar child processes and session state.
//!
//! Design (KODEX §13–15): the Tauri host owns every scanner process it
//! starts — start, cancellation, timeout, crash detection, exit cleanup,
//! descendant cleanup, subsequent-scan recovery. Detection semantics live in
//! the sidecar (Node scanner worker); this module only supervises lifecycle
//! and persists validated result files.
//!
//! Ownership model: the child stays in the record for its whole life.
//! `wait_sidecar` borrows the pid for waiting WITHOUT taking the Child out,
//! so `cancel` always finds a live kill handle. Only the terminal reaper
//! (wait completion or cancel) takes the Child + Job guard out.

use crate::evidence::SessionEvidence;
use crate::validation::{validate_detail_bundle, validate_extra_bundle, validate_sidecar_stdout};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

fn sidecar_watchdog_sec(worker_timeout_sec: u64) -> u64 {
    worker_timeout_sec
        .saturating_add(crate::config::number("deadline", "hostGraceSec"))
        .min(crate::config::number("deadline", "hardLimitSec"))
}

#[cfg(any(windows, test))]
fn bundled_windows_runtime(
    sidecar: &std::path::Path,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let directory = sidecar.parent().ok_or("Invalid worker resource location")?;
    let node = directory.join("node.exe");
    let browsers = directory.join("ms-playwright");
    if !node.is_file() {
        return Err("BUNDLED_NODE_MISSING: Reinstall the complete application package.".into());
    }
    if !browsers.is_dir() {
        return Err("BUNDLED_BROWSER_MISSING: Reinstall the complete application package.".into());
    }
    Ok((node, browsers))
}

#[cfg(windows)]
use crate::job::JobGuard;
#[cfg(not(windows))]
use crate::job_fallback::JobGuard;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionStatus {
    Running,
    Finalizing,
    Succeeded,
    Cancelled,
    Failed,
}

impl SessionStatus {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Finalizing => "finalizing",
            Self::Succeeded => "succeeded",
            Self::Cancelled => "cancelled",
            Self::Failed => "failed",
        }
    }
}

// `Child`/`JobGuard` are not Debug; keep an explicit opaque record.
pub struct SessionRecord {
    pub id: String,
    pub entry_url: String,
    pub status: SessionStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error: Option<String>,
    pub cancel_requested: bool,
    pub child: Option<tokio::process::Child>,
    pub child_pid: Option<u32>,
    pub job: Option<JobGuard>,
    pub result_json: Option<String>,
    evidence: Option<SessionEvidence>,
    pub extra_json: Option<String>,
    pub progress: ProgressSnapshot,
    pub settings: serde_json::Value,
    pub warp_failure: Option<crate::warp::WarpFailureCode>,
}

impl SessionRecord {
    fn new(id: String, entry_url: String, started_at: String) -> Self {
        Self {
            id,
            entry_url,
            status: SessionStatus::Running,
            started_at,
            finished_at: None,
            error: None,
            cancel_requested: false,
            child: None,
            child_pid: None,
            job: None,
            result_json: None,
            evidence: None,
            extra_json: None,
            progress: ProgressSnapshot::default(),
            settings: serde_json::json!({}),
            warp_failure: None,
        }
    }
}

/// Sidecar wait outcome: stdout bytes on success, detail on failure.
/// Cancelled means an explicit cancel already owns the session state.
pub enum SessionOutcome {
    Succeeded { stdout: String },
    Failed { detail: String },
    Cancelled,
}

/// Live progress callback: receives one `scan-event`-shaped JSON value per
/// `KRDSPROGRESS {...}` worker-stderr line, so the progress screen shows real
/// counters (KODEX §36) instead of zeros until completion.
pub type ProgressSink = std::sync::Arc<dyn Fn(serde_json::Value) + Send + Sync>;

#[derive(Default, Clone)]
pub struct ProgressSnapshot {
    pub sequence: u64,
    pub pages: u64,
    pub failed_pages: u64,
    pub queued_pages: u64,
    pub current_pages: Vec<String>,
    pub recent_activity: Vec<serde_json::Value>,
    pub frames_inspected: u64,
    pub elements_analyzed: u64,
    pub candidates: u64,
    pub findings: u64,
    pub elapsed_sec: f64,
}

impl ProgressSnapshot {
    pub fn terminal_value(&self, stage: &str) -> serde_json::Value {
        self.value(stage, true)
    }

    fn value(&self, stage: &str, terminal: bool) -> serde_json::Value {
        let mut recent_activity = self.recent_activity.clone();
        if terminal {
            let kind = match stage {
                "succeeded" => "session-finished",
                "cancelled" => "session-cancelled",
                _ => "session-failed",
            };
            recent_activity.insert(
                0,
                serde_json::json!({"sequence": self.sequence + 1,
                "kind": kind, "stage": stage, "elapsedSec": self.elapsed_sec}),
            );
            recent_activity.truncate(5);
        }
        serde_json::json!({
            "sequence": self.sequence + u64::from(terminal),
            "visitedPages": self.pages,
            "failedPages": self.failed_pages,
            "queuedPages": if terminal { 0 } else { self.queued_pages },
            "currentPages": if terminal { Vec::<String>::new() } else { self.current_pages.clone() },
            "recentActivity": recent_activity,
            "framesInspected": self.frames_inspected,
            "elementsAnalyzed": self.elements_analyzed,
            "candidates": self.candidates,
            "confirmedFindings": self.findings,
            "elapsedSec": self.elapsed_sec,
            "stage": stage,
        })
    }
}

#[derive(Default)]
pub struct SessionRegistry {
    inner: Mutex<HashMap<String, SessionRecord>>,
    case_operations: Mutex<()>,
    store: Option<crate::case_store::CaseStore>,
}

impl SessionRegistry {
    pub fn persistent(root: std::path::PathBuf) -> Result<Arc<Self>, String> {
        Ok(Arc::new(Self {
            inner: Mutex::new(HashMap::new()),
            case_operations: Mutex::new(()),
            store: Some(crate::case_store::CaseStore::new(root)?),
        }))
    }

    pub fn case_store(&self) -> Result<&crate::case_store::CaseStore, String> {
        self.store
            .as_ref()
            .ok_or("persistent case storage unavailable".into())
    }

    pub async fn open_case(&self, id: &str) -> Result<serde_json::Value, String> {
        let _operation = self.case_operations.lock().await;
        let case = self.case_store()?.open(id)?;
        let response = serde_json::json!({"manifest":case.manifest,"review":case.review,"directory":case.directory});
        let mut record =
            SessionRecord::new(id.into(), case.manifest.entry_url, case.manifest.started_at);
        record.status = if case.manifest.status == "cancelled" {
            SessionStatus::Cancelled
        } else if case.manifest.status == "failed" {
            SessionStatus::Failed
        } else {
            SessionStatus::Succeeded
        };
        record.finished_at = Some(case.manifest.finished_at);
        record.progress.findings = case.manifest.findings as u64;
        record.result_json = Some(case.official);
        record.extra_json = case.extra;
        record.evidence = case.evidence;
        record.settings = case.manifest.settings;
        if let Some(failure) = record.settings.get("transportFailure").and_then(|v| serde_json::from_value::<crate::warp::TransportFailure>(v.clone()).ok()) {
            record.warp_failure = Some(failure.code);
            record.error = Some(serde_json::to_value(failure.code).unwrap().as_str().unwrap().to_string());
        }
        let mut guard = self.inner.lock().await;
        if guard
            .get(id)
            .is_some_and(|r| matches!(r.status, SessionStatus::Running | SessionStatus::Finalizing))
        {
            return Err("case scan still active".into());
        }
        guard.insert(id.into(), record);
        Ok(response)
    }
    #[must_use]
    #[cfg(test)]
    pub fn shared() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn inner_clone(self: &Arc<Self>) -> Arc<Self> {
        Arc::clone(self)
    }

    pub async fn insert(&self, record: SessionRecord) {
        self.inner.lock().await.insert(record.id.clone(), record);
    }

    pub async fn delete_case(&self, id: &str) -> Result<(), String> {
        let _operation = self.case_operations.lock().await;
        let guard = self.inner.lock().await;
        if guard
            .get(id)
            .is_some_and(|r| matches!(r.status, SessionStatus::Running | SessionStatus::Finalizing))
        {
            return Err("active case cannot be deleted".into());
        }
        drop(guard);
        self.case_store()?.delete(id)?;
        self.inner.lock().await.remove(id);
        Ok(())
    }

    pub async fn import_case(&self, path: &std::path::Path) -> Result<String, String> {
        let _operation = self.case_operations.lock().await;
        self.case_store()?.import_directory(path)
    }

    /// Request cooperative settlement before the bounded process-tree kill.
    /// The monitor owns reaping; cancellation is terminal only after the host
    /// has validated any artifacts written by the settling worker.
    pub async fn cancel(&self, session_id: &str, finished_at: String) -> bool {
        use tokio::io::AsyncWriteExt;
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        match record.status {
            SessionStatus::Succeeded | SessionStatus::Failed | SessionStatus::Cancelled => {
                return true;
            }
            _ => {}
        }
        if record.cancel_requested {
            return true;
        }
        record.cancel_requested = true;
        record.status = SessionStatus::Finalizing;
        let has_child = record.child.is_some();
        let stdin = record.child.as_mut().and_then(|child| child.stdin.take());
        if !has_child && record.child_pid.is_none() {
            record.status = SessionStatus::Cancelled;
            record.finished_at = Some(finished_at);
            return true;
        }
        drop(guard);
        if let Some(mut stdin) = stdin {
            let _ = tokio::time::timeout(std::time::Duration::from_secs(1), async {
                stdin.write_all(b"{\"type\":\"cancel\"}\n").await?;
                stdin.shutdown().await
            })
            .await;
        }
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(10);
        loop {
            let mut guard = self.inner.lock().await;
            let Some(record) = guard.get_mut(session_id) else {
                return false;
            };
            let Some(child) = record.child.as_mut() else {
                break;
            };
            if matches!(child.try_wait(), Ok(Some(_))) {
                break;
            }
            if tokio::time::Instant::now() >= deadline {
                let child = record.child.take();
                let job = record.job.take();
                record.child_pid = None;
                drop(guard);
                if let Some(mut child) = child {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                }
                drop(job);
                break;
            }
            drop(guard);
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        true
    }

    pub async fn cancellation_requested(&self, session_id: &str) -> bool {
        self.inner
            .lock()
            .await
            .get(session_id)
            .is_some_and(|record| record.cancel_requested)
    }

    /// Store only a fully validated partial bundle, then publish cancellation.
    pub async fn complete_cancellation(
        &self,
        session_id: &str,
        bundle: Option<(String, String, String)>,
        error: Option<String>,
        finished_at: String,
    ) {
        let context = self
            .inner
            .lock()
            .await
            .get(session_id)
            .filter(|r| r.cancel_requested)
            .map(|r| (r.entry_url.clone(), r.settings.clone()));
        let Some((entry, settings)) = context else {
            return;
        };
        let mut bundle = bundle;
        let mut evidence = None;
        if let Some(store) = &self.store {
            let saved = if store.open(session_id).is_ok() {
                Some(store.mark_cancelled(session_id))
            } else {
                bundle.as_ref().map(|(canonical, detail, extra)| {
                    store.commit(crate::case_store::NewCase {
                        id: session_id,
                        entry_url: &entry,
                        official: canonical,
                        detail: Some(detail),
                        extra: Some(extra),
                        status: "cancelled",
                        settings,
                    })
                })
            };
            if let Some(saved) = saved {
                match saved {
                    Ok(case) => {
                        evidence = case.evidence;
                        bundle =
                            Some((case.official, String::new(), case.extra.unwrap_or_default()));
                    }
                    Err(save_error) => {
                        let mut guard = self.inner.lock().await;
                        if let Some(record) = guard.get_mut(session_id) {
                            record.status = SessionStatus::Cancelled;
                            record.error = Some(save_error);
                            record.finished_at = Some(finished_at);
                        }
                        return;
                    }
                }
            }
        } else if let Some((canonical, detail, extra)) = &bundle {
            let empty_extra=serde_json::json!({"meta":serde_json::from_str::<serde_json::Value>(canonical).unwrap_or_default()["meta"],"findings":[]}).to_string();
            evidence = validate_detail_bundle(
                canonical,
                detail,
                if validate_extra_bundle(canonical, extra).is_ok() {
                    extra
                } else {
                    &empty_extra
                },
            )
            .ok()
            .and_then(|()| SessionEvidence::from_json(detail).ok());
        }
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return;
        };
        if !record.cancel_requested {
            return;
        }
        if let Some((canonical, _detail, extra)) = bundle {
            record.progress.findings = serde_json::from_str::<serde_json::Value>(&canonical)
                .ok()
                .and_then(|value| value["findings"].as_array().map(|items| items.len() as u64))
                .unwrap_or(0);
            record.result_json = Some(canonical);
            record.evidence = evidence;
            record.extra_json =
                validate_extra_bundle(record.result_json.as_deref().unwrap_or_default(), &extra)
                    .ok()
                    .map(|()| extra);
        }
        record.status = SessionStatus::Cancelled;
        record.finished_at = Some(finished_at);
        record.error = error;
        record.child_pid = None;
    }

    /// Host backstop for a stalled worker. The worker owns the scan clock;
    /// this guard kills its process tree if it has not exited by the limit.
    pub async fn terminate_at_deadline(&self, session_id: &str, finished_at: String) -> bool {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        if matches!(
            record.status,
            SessionStatus::Succeeded | SessionStatus::Failed | SessionStatus::Cancelled
        ) {
            return false;
        }
        let child = record.child.take();
        record.job.take();
        drop(guard);
        if let Some(mut child) = child {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        if record.cancel_requested {
            return false;
        }
        record.child_pid = None;
        record.status = SessionStatus::Failed;
        record.finished_at = Some(finished_at);
        record.error = Some("scan deadline reached; worker process stopped".to_string());
        true
    }

    pub async fn store_result(
        &self,
        session_id: &str,
        canonical: String,
        detail_json: String,
        extra_json: String,
        finished_at: String,
    ) -> bool {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        // Never overwrite a terminal cancel/fail with a late success.
        if record.cancel_requested
            || matches!(
                record.status,
                SessionStatus::Cancelled | SessionStatus::Failed
            )
        {
            return false;
        }
        let entry = record.entry_url.clone();
        let failure = record.warp_failure;
        if let Some(code) = failure {
            record.settings["transportFailure"] = serde_json::to_value(crate::warp::TransportFailure {code, scope: crate::warp::FailureScope::Incomplete}).unwrap();
        }
        let settings = record.settings.clone();
        let canonical = match validate_sidecar_stdout(&entry, &canonical) {
            Ok(_) if failure.is_some() => canonical,
            Ok(value) => value,
            Err(error) => {
                drop(guard);
                self.fail(session_id, error, finished_at).await;
                return false;
            }
        };
        let extra = validate_extra_bundle(&canonical, &extra_json)
            .ok()
            .map(|()| extra_json);
        let empty_extra = serde_json::json!({"meta":serde_json::from_str::<serde_json::Value>(&canonical).unwrap()["meta"],"findings":[]}).to_string();
        let mut evidence = validate_detail_bundle(
            &canonical,
            &detail_json,
            extra.as_deref().unwrap_or(&empty_extra),
        )
        .ok()
        .and_then(|()| SessionEvidence::from_json(&detail_json).ok());
        if let Some(store) = &self.store {
            match store.commit(crate::case_store::NewCase {
                id: session_id,
                entry_url: &entry,
                official: &canonical,
                detail: Some(&detail_json),
                extra: extra.as_deref(),
                status: if failure.is_some() { "failed" } else { "succeeded" },
                settings,
            }) {
                Ok(case) => {
                    evidence = case.evidence;
                }
                Err(error) => {
                    drop(guard);
                    self.fail(session_id, error, finished_at).await;
                    return false;
                }
            }
        }
        record.result_json = Some(canonical);
        if let Some(count) = record
            .result_json
            .as_deref()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
            .and_then(|value| {
                value
                    .get("findings")
                    .and_then(serde_json::Value::as_array)
                    .map(|items| items.len() as u64)
            })
        {
            record.progress.findings = count;
        }
        record.evidence = evidence;
        record.extra_json = extra;
        record.status = if failure.is_some() {SessionStatus::Failed} else {SessionStatus::Succeeded};
        record.finished_at = Some(finished_at);
        record.error = failure.map(|code| serde_json::to_value(code).unwrap().as_str().unwrap().to_string());
        record.child_pid = None;
        true
    }

    pub async fn fail(&self, session_id: &str, detail: String, finished_at: String) {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return;
        };
        if record.cancel_requested || matches!(record.status, SessionStatus::Cancelled) {
            return;
        }
        record.status = SessionStatus::Failed;
        record.finished_at = Some(finished_at);
        record.error = Some(detail);
    }

    pub async fn snapshot(&self, session_id: &str) -> Option<serde_json::Value> {
        let guard = self.inner.lock().await;
        let record = guard.get(session_id)?;
        Some(serde_json::json!({
            "id": record.id,
            "entryUrl": record.entry_url,
            "status": record.status.as_str(),
            "startedAt": record.started_at,
            "finishedAt": record.finished_at,
            "error": record.error,
            "hasResult": record.result_json.is_some(),
            "progress": record.progress.value(record.status.as_str(), matches!(record.status,
                SessionStatus::Succeeded | SessionStatus::Cancelled | SessionStatus::Failed)),
        }))
    }

    pub async fn result_value(&self, session_id: &str) -> Option<serde_json::Value> {
        let guard = self.inner.lock().await;
        let text = guard.get(session_id)?.result_json.clone()?;
        serde_json::from_str(&text).ok()
    }

    pub async fn coverage_value(&self, session_id: &str) -> Option<serde_json::Value> {
        Some(
            self.inner
                .lock()
                .await
                .get(session_id)?
                .evidence
                .as_ref()?
                .coverage(),
        )
    }

    pub async fn finding_detail_value(
        &self,
        session_id: &str,
        finding_id: &str,
    ) -> Option<serde_json::Value> {
        self.inner
            .lock()
            .await
            .get(session_id)?
            .evidence
            .as_ref()?
            .finding(finding_id)
    }

    pub async fn evidence_asset_value(
        &self,
        session_id: &str,
        asset_id: &str,
    ) -> Option<serde_json::Value> {
        self.inner
            .lock()
            .await
            .get(session_id)?
            .evidence
            .as_ref()?
            .asset(asset_id)
    }

    pub async fn evidence_summary_value(&self, session_id: &str) -> Option<serde_json::Value> {
        Some(
            self.inner
                .lock()
                .await
                .get(session_id)?
                .evidence
                .as_ref()?
                .summary(),
        )
    }

    pub async fn image_analysis_value(
        &self,
        session_id: &str,
        query: &serde_json::Value,
    ) -> Result<Option<serde_json::Value>, String> {
        let guard = self.inner.lock().await;
        let Some(index) = guard
            .get(session_id)
            .and_then(|record| record.evidence.as_ref())
        else {
            return Ok(None);
        };
        index.images(query).map(Some)
    }

    pub async fn evidence_graph_value(
        &self,
        session_id: &str,
        query: &serde_json::Value,
    ) -> Result<Option<serde_json::Value>, String> {
        let guard = self.inner.lock().await;
        let Some(index) = guard
            .get(session_id)
            .and_then(|record| record.evidence.as_ref())
        else {
            return Ok(None);
        };
        index.graph_slice(query).map(Some)
    }

    pub async fn extra_value(&self, session_id: &str) -> Option<serde_json::Value> {
        let guard = self.inner.lock().await;
        let text = guard.get(session_id)?.extra_json.clone()?;
        serde_json::from_str(&text).ok()
    }

    pub async fn validated_export_text(&self, session_id: &str) -> Result<String, String> {
        let guard = self.inner.lock().await;
        let record = guard.get(session_id).ok_or("unknown session")?;
        if !matches!(
            record.status,
            SessionStatus::Succeeded | SessionStatus::Cancelled | SessionStatus::Failed
        ) {
            return Err("no validated result stored for session yet".to_string());
        }
        let text = record
            .result_json
            .as_deref()
            .ok_or("no result stored for session yet")?;
        let normalized = validate_sidecar_stdout(&record.entry_url, text)
            .map_err(|error| format!("stored result invalid, export blocked: {error}"))?;
        Ok(if record.status == SessionStatus::Failed {text.to_string()} else {normalized})
    }

    pub async fn progress_snapshot(&self, session_id: &str) -> ProgressSnapshot {
        let guard = self.inner.lock().await;
        let Some(record) = guard.get(session_id) else {
            return ProgressSnapshot::default();
        };
        let validated_findings = record
            .result_json
            .as_deref()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
            .and_then(|value| {
                value
                    .get("findings")
                    .and_then(serde_json::Value::as_array)
                    .map(|items| items.len() as u64)
            });
        let mut snapshot = record.progress.clone();
        if let Some(findings) = validated_findings {
            snapshot.findings = findings;
        }
        snapshot
    }

    async fn record_progress(&self, session_id: &str, progress: &serde_json::Value) -> bool {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        if matches!(
            record.status,
            SessionStatus::Succeeded | SessionStatus::Cancelled | SessionStatus::Failed
        ) {
            return false;
        }
        let snapshot = &mut record.progress;
        let count = |field: &str| progress.get(field).and_then(serde_json::Value::as_u64);
        let Some(sequence) = count("sequence") else {
            return false;
        };
        if sequence <= snapshot.sequence {
            return false;
        }
        snapshot.sequence = sequence;
        if let Some(value) = count("queuedPages") {
            snapshot.queued_pages = value;
        }
        if let Some(value) = count("failedPages") {
            snapshot.failed_pages = snapshot.failed_pages.max(value);
        }
        snapshot.current_pages = progress
            .get("currentPages")
            .and_then(serde_json::Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .take(4)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default();
        snapshot.recent_activity = progress
            .get("recentActivity")
            .and_then(serde_json::Value::as_array)
            .map(|items| items.iter().take(5).cloned().collect())
            .unwrap_or_default();
        if progress.get("stage").and_then(serde_json::Value::as_str) == Some("finalizing") {
            record.status = SessionStatus::Finalizing;
        }
        if let Some(value) = count("visitedPages") {
            snapshot.pages = snapshot.pages.max(value);
        }
        if let Some(value) = count("framesInspected") {
            snapshot.frames_inspected = snapshot.frames_inspected.max(value);
        }
        if let Some(value) = count("elementsAnalyzed") {
            snapshot.elements_analyzed = snapshot.elements_analyzed.max(value);
        }
        if let Some(value) = count("candidates") {
            snapshot.candidates = snapshot.candidates.max(value);
        }
        if let Some(value) = count("confirmedFindings") {
            snapshot.findings = snapshot.findings.max(value);
        }
        if let Some(value) = progress
            .get("elapsedSec")
            .and_then(serde_json::Value::as_f64)
        {
            if value.is_finite() {
                snapshot.elapsed_sec = snapshot.elapsed_sec.max(value);
            }
        }
        true
    }
    /// Allow worker startup and final artifact writes beyond its scan clock,
    /// while retaining the host's absolute 1650-second backstop.
    pub async fn wait_sidecar_with_watchdog(
        self: &Arc<Self>,
        session_id: &str,
        on_progress: ProgressSink,
        timeout_sec: u64,
    ) -> SessionOutcome {
        let guard_sec = sidecar_watchdog_sec(timeout_sec);
        match tokio::time::timeout(
            std::time::Duration::from_secs(guard_sec),
            self.wait_sidecar_with_progress(session_id, on_progress),
        )
        .await
        {
            Ok(outcome) => outcome,
            Err(_) => {
                if self
                    .terminate_at_deadline(session_id, chrono::Utc::now().to_rfc3339())
                    .await
                {
                    SessionOutcome::Failed {
                        detail: "scan deadline reached; worker process stopped".to_string(),
                    }
                } else {
                    SessionOutcome::Cancelled
                }
            }
        }
    }

    /// Wait with live progress forwarding: `on_progress` receives one
    /// `scan-event`-shaped JSON value per non-terminal KRDSPROGRESS stderr line.
    ///
    /// Authoritative completion: worker terminal events (`session-finished`,
    /// `session-failed`, `session-cancelled`) are NEVER forwarded. Only the
    /// host emits final completion after validation, persistence, and final
    /// status are consistent (finish_session) — otherwise the UI navigates
    /// on the worker's word and fetches the result before it is stored.
    ///
    /// Diagnostics: non-progress stderr lines are kept in a bounded buffer
    /// (64 lines, 500 chars each) and appended to failure details, so a
    /// stderr-only failure still explains itself. Cancellation keeps
    /// ownership: the Child stays registered, the pump is aborted, and no
    /// reader outlives the wait.
    pub async fn wait_sidecar_with_progress(
        self: &Arc<Self>,
        session_id: &str,
        on_progress: ProgressSink,
    ) -> SessionOutcome {
        use std::collections::VecDeque;
        use tokio::io::BufReader;
        let stderr = {
            let mut guard = self.inner.lock().await;
            let Some(record) = guard.get_mut(session_id) else {
                return SessionOutcome::Failed {
                    detail: "unknown session".to_string(),
                };
            };
            record.child.as_mut().and_then(|c| c.stderr.take())
        };
        let Some(stderr) = stderr else {
            return self.wait_sidecar(session_id).await;
        };
        let session_owned = session_id.to_string();
        let registry = Arc::clone(self);
        let diagnostics = std::sync::Arc::new(tokio::sync::Mutex::new(VecDeque::<String>::new()));
        let pump_diagnostics = diagnostics.clone();
        let mut pump = tokio::spawn(async move {
            let mut lines = BufReader::new(stderr);
            while let Ok(Some(line)) = read_worker_line(&mut lines).await {
                if registry.record_worker_metadata(&session_owned, &line).await {continue;}
                if let Some(payload) = line.split_once("KRDSPROGRESS ") {
                    let Ok(value) = serde_json::from_str::<serde_json::Value>(payload.1) else {
                        continue;
                    };
                    let kind = value
                        .get("kind")
                        .and_then(|k| k.as_str())
                        .unwrap_or("stage-changed");
                    // Terminal events are the worker's opinion, not the
                    // host's verdict: drop them here, finish_session emits.
                    if matches!(
                        kind,
                        "session-finished" | "session-failed" | "session-cancelled"
                    ) {
                        continue;
                    }
                    let Some(progress) = value.get("progress").cloned() else {
                        continue;
                    };
                    if registry.record_progress(&session_owned, &progress).await {
                        on_progress(serde_json::json!({
                            "kind": kind,
                            "sessionId": session_owned,
                            "at": chrono::Utc::now().to_rfc3339(),
                            "progress": progress,
                            "message": value.get("message"),
                            "pageUrl": value.get("pageUrl"),
                        }));
                    }
                } else if !line.trim().is_empty() {
                    let mut buffer = pump_diagnostics.lock().await;
                    if buffer.len() >= 64 {
                        buffer.pop_front();
                    }
                    let mut text = line;
                    if text.len() > 500 {
                        text.truncate(500);
                    }
                    buffer.push_back(text);
                }
            }
        });
        let outcome = self.wait_sidecar(session_id).await;
        // The child has exited (or was cancelled): the pipe is at EOF, so
        // awaiting the pump cannot block. Abort is only a backstop.
        if tokio::time::timeout(std::time::Duration::from_secs(5), &mut pump)
            .await
            .is_err()
        {
            pump.abort();
            let _ = pump.await;
        }
        match outcome {
            SessionOutcome::Failed { detail } => {
                if let Some(code) = self.inner.lock().await.get(session_id).and_then(|r| r.warp_failure) {
                    return SessionOutcome::Failed {detail: serde_json::to_value(code).unwrap().as_str().unwrap().to_string()};
                }
                let buffer = diagnostics.lock().await;
                if buffer.is_empty() {
                    SessionOutcome::Failed { detail }
                } else {
                    let tail = buffer.iter().cloned().collect::<Vec<_>>().join("\n");
                    let mut combined = format!("{detail}\nsidecar stderr:\n{tail}");
                    if combined.len() > 2048 {
                        combined.truncate(2048);
                    }
                    SessionOutcome::Failed { detail: combined }
                }
            }
            other => other,
        }
    }

    /// Metadata is attributed only to the session whose owned child pipe was read.
    /// Return true for every marker-shaped record, including invalid/oversized ones,
    /// so rejected fields can never be copied into error diagnostics.
    async fn record_worker_metadata(&self, session_id: &str, line: &str) -> bool {
        let transport = line.strip_prefix("KRDSTRANSPORT ");
        let failure = line.strip_prefix("KRDSWARPERROR ");
        if transport.is_none() && failure.is_none() {
            return line.contains("KRDSTRANSPORT") || line.contains("KRDSWARPERROR");
        }
        if line.len() > 512 {return true;}
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {return true;};
        if record.cancel_requested || !matches!(record.status, SessionStatus::Running | SessionStatus::Finalizing) {return true;}
        if let Some(payload) = transport {
            if record.settings.get("transport").is_none() {
                if let Ok(value) = serde_json::from_str::<crate::warp::TransportProvenance>(payload) {
                    record.settings["transport"] = serde_json::to_value(value).unwrap();
                }
            }
        } else if let Some(payload) = failure {
            #[derive(serde::Deserialize)]
            #[serde(deny_unknown_fields)]
            struct FailureRecord {code: crate::warp::WarpFailureCode}
            if let Ok(value) = serde_json::from_str::<FailureRecord>(payload) {record.warp_failure.get_or_insert(value.code);}
        }
        true
    }

    /// Wait for the owned sidecar child WITHOUT removing it from the record:
    /// the Child stays registered so `cancel` can always kill it. Poll via
    /// brief lock acquisitions; terminal reaping (taking Child + Job)
    /// happens exactly once — here on natural exit, or in `cancel`.
    pub async fn wait_sidecar(&self, session_id: &str) -> SessionOutcome {
        loop {
            enum Poll {
                Failed(String),
                Running,
                Exited,
            }
            let step: Poll = {
                let mut guard = self.inner.lock().await;
                let Some(record) = guard.get_mut(session_id) else {
                    return SessionOutcome::Failed {
                        detail: "unknown session".to_string(),
                    };
                };
                if record.status == SessionStatus::Cancelled {
                    return SessionOutcome::Cancelled;
                }
                let Some(child) = record.child.as_mut() else {
                    if record.status == SessionStatus::Failed {
                        let detail = record
                            .error
                            .clone()
                            .unwrap_or_else(|| "sidecar missing".to_string());
                        return SessionOutcome::Failed { detail };
                    }
                    return SessionOutcome::Cancelled;
                };
                match child.try_wait() {
                    Ok(Some(_)) => Poll::Exited,
                    Ok(None) => Poll::Running,
                    Err(e) => Poll::Failed(format!("sidecar poll failed: {e}")),
                }
            };
            match step {
                Poll::Failed(detail) => return SessionOutcome::Failed { detail },
                Poll::Running => {
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                }
                Poll::Exited => {
                    let mut guard = self.inner.lock().await;
                    let Some(record) = guard.get_mut(session_id) else {
                        return SessionOutcome::Failed {
                            detail: "unknown session".to_string(),
                        };
                    };
                    let Some(child) = record.child.take() else {
                        return SessionOutcome::Cancelled;
                    };
                    let cancelled = record.cancel_requested;
                    record.job.take();
                    drop(guard);
                    let output = Self::collect_output(child, session_id).await;
                    if cancelled || self.cancellation_requested(session_id).await {
                        return SessionOutcome::Cancelled;
                    }
                    return output;
                }
            }
        }
    }

    /// Collect piped output from an exited child (called after try_wait
    /// observed exit, or for a freshly spawned child in tests).
    async fn collect_output(child: tokio::process::Child, session_id: &str) -> SessionOutcome {
        match child.wait_with_output().await {
            Ok(output) => {
                if output.status.success() {
                    let mut stdout = String::from_utf8_lossy(&output.stdout).into_owned();
                    // --out-file fallback: the sidecar writes UTF-8 directly
                    // when shell redirection would corrupt the pipe.
                    if stdout.trim().is_empty() {
                        let candidate =
                            std::env::temp_dir().join(format!("krds-result-{session_id}.json"));
                        if let Ok(text) = std::fs::read_to_string(&candidate) {
                            stdout = text;
                        }
                    }
                    SessionOutcome::Succeeded { stdout }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    SessionOutcome::Failed {
                        detail: format!("sidecar exited {}: {}", output.status, stderr.trim()),
                    }
                }
            }
            Err(e) => SessionOutcome::Failed {
                detail: format!("sidecar wait failed: {e}"),
            },
        }
    }

    /// Spawn the scanner sidecar for a session and register the child.
    /// The sidecar command is fixed (bundled worker binary); the frontend
    /// supplies only scan parameters, never a shell string.
    ///
    /// The child is attached to a kill-on-close Job owned by the SESSION
    /// record (not the host process): on cancel/crash/timeout/app-exit the
    /// guard drops and the whole worker→browser→renderer tree dies.
    /// Job membership is assigned to the CHILD pid after spawn.
    pub async fn spawn_sidecar(
        self: &Arc<Self>,
        session_id: &str,
        sidecar_path: &str,
        args: &[&str],
    ) -> Result<u32, String> {
        use std::process::Stdio as SyncStdio;
        // Reserve the record first (short lock), then spawn without holding
        // the mutex across the OS call.
        {
            let guard = self.inner.lock().await;
            let record = guard.get(session_id).ok_or("unknown session")?;
            if record.cancel_requested {
                return Err("session cancelled before worker startup".to_string());
            }
        }
        // Installed execution uses only the worker-adjacent, inventoried
        // runtime. Caller environment and per-user caches are not fallbacks.
        #[cfg(windows)]
        let (node_bin, browser_dir) = bundled_windows_runtime(std::path::Path::new(sidecar_path))?;
        #[cfg(not(windows))]
        let node_bin = "node".to_string();
        let mut cmd = std::process::Command::new(&node_bin);
        cmd.arg(sidecar_path);
        #[cfg(windows)]
        {
            cmd.env("PLAYWRIGHT_BROWSERS_PATH", browser_dir);
        }
        cmd.args(args)
            .stdin(SyncStdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        {
            #[allow(unused_imports)]
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: no console flash for the worker.
            cmd.creation_flags(0x0800_0000);
        }
        let mut child = tokio::process::Command::from(cmd)
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("sidecar spawn failed: {e}"))?;
        let pid = child.id().unwrap_or(0);
        #[cfg(windows)]
        {
            // Assign the CHILD (not the host) to a kill-on-close Job so the
            // worker→browser→renderer tree dies with the session guard.
            // The guard lives in the session record; drop = whole-tree kill.
            let job = JobGuard::assign_pid(pid)?;
            let mut guard = self.inner.lock().await;
            let record = guard
                .get_mut(session_id)
                .ok_or_else(|| "unknown session".to_string())?;
            if record.cancel_requested {
                drop(job);
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("session cancelled before worker startup".to_string());
            }
            record.job = Some(job);
            record.child = Some(child);
            record.child_pid = Some(pid);
        }
        #[cfg(not(windows))]
        {
            let mut guard = self.inner.lock().await;
            let record = guard
                .get_mut(session_id)
                .ok_or_else(|| "unknown session".to_string())?;
            if record.cancel_requested {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("session cancelled before worker startup".to_string());
            }
            record.child = Some(child);
            record.child_pid = Some(pid);
        }
        Ok(pid)
    }
    /// Test-only: spawn an arbitrary shell child into the session record
    /// (pump tests need stderr writers, not the real sidecar).
    #[cfg(test)]
    pub async fn spawn_sidecar_for_test(
        &self,
        session_id: &str,
        argv: &[&str],
    ) -> Result<u32, String> {
        use std::process::Stdio as SyncStdio;
        {
            let guard = self.inner.lock().await;
            if !guard.contains_key(session_id) {
                return Err("unknown session".to_string());
            }
        }
        let mut cmd = tokio::process::Command::new(argv[0]);
        cmd.args(&argv[1..])
            .stdin(SyncStdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        let child = cmd.spawn().map_err(|e| format!("test spawn failed: {e}"))?;
        let pid = child.id().unwrap_or(0);
        let mut guard = self.inner.lock().await;
        let record = guard
            .get_mut(session_id)
            .ok_or_else(|| "unknown session".to_string())?;
        record.child = Some(child);
        record.child_pid = Some(pid);
        Ok(pid)
    }
}

pub fn new_session(entry_url: String, started_at: String) -> SessionRecord {
    let id = uuid::Uuid::new_v4().to_string();
    SessionRecord::new(id, entry_url, started_at)
}

// Drain oversized lines without allocating or ever treating their suffix as diagnostics.
async fn read_worker_line<R: tokio::io::AsyncBufRead + Unpin>(reader: &mut R) -> std::io::Result<Option<String>> {
    use tokio::io::AsyncBufReadExt;
    let mut bytes = Vec::new(); let mut oversized = false; let mut seen = false;
    loop {
        let chunk = reader.fill_buf().await?;
        if chunk.is_empty() {return Ok(if seen {Some(if oversized {String::new()} else {String::from_utf8(bytes).unwrap_or_default()})} else {None});}
        seen = true;
        let end = chunk.iter().position(|b| *b == b'\n');
        let length = end.map_or(chunk.len(), |n| n + 1);
        if !oversized {
            if bytes.len() + length > 65536 {oversized = true; bytes.clear();}
            else {bytes.extend_from_slice(&chunk[..length]);}
        }
        reader.consume(length);
        if end.is_some() {return Ok(Some(if oversized {String::new()} else {String::from_utf8(bytes).unwrap_or_default().trim_end_matches(['\r', '\n']).to_string()}));}
    }
}

/// Cancellation can arrive after a natural worker exit. Validate its completed
/// artifacts identically, then mark coverage with the host's cancellation verdict.
pub(crate) fn load_cancelled_bundle(
    entry_url: &str,
    result_path: &std::path::Path,
    detail_path: &std::path::Path,
    extra_path: &std::path::Path,
) -> Result<(String, String, String), String> {
    let result = String::from_utf8(crate::case_store::read_bounded(result_path, 16_000_000)?)
        .map_err(|e| e.to_string())?;
    let canonical = validate_sidecar_stdout(entry_url, &result)?;
    let extra = crate::case_store::read_bounded(extra_path, 16_000_000)
        .ok()
        .and_then(|b| String::from_utf8(b).ok())
        .filter(|s| validate_extra_bundle(&canonical, s).is_ok())
        .unwrap_or_default();
    let empty_extra=serde_json::json!({"meta":serde_json::from_str::<serde_json::Value>(&canonical).unwrap()["meta"],"findings":[]}).to_string();
    let detail = crate::case_store::read_bounded(detail_path, 8_000_000)
        .ok()
        .and_then(|b| String::from_utf8(b).ok())
        .filter(|s| {
            validate_detail_bundle(
                &canonical,
                s,
                if extra.is_empty() {
                    &empty_extra
                } else {
                    &extra
                },
            )
            .is_ok()
        })
        .and_then(|s| {
            let mut parsed: serde_json::Value = serde_json::from_str(&s).ok()?;
            parsed["coverage"]["cancelled"] = serde_json::json!(true);
            serde_json::to_string(&parsed).ok()
        })
        .unwrap_or_default();
    Ok((canonical, detail, extra))
}

#[cfg(test)]
mod tests {
    use super::{new_session, SessionRegistry, SessionStatus};

    #[test]
    fn incomplete_installed_runtimes_are_rejected_before_spawn() {
        let directory = std::env::temp_dir().join(format!("krds-runtime-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        let worker = directory.join("scanner-worker.mjs");
        let missing_node = super::bundled_windows_runtime(&worker).unwrap_err();
        assert!(missing_node.starts_with("BUNDLED_NODE_MISSING:"));
        std::fs::write(directory.join("node.exe"), []).unwrap();
        let missing_browser = super::bundled_windows_runtime(&worker).unwrap_err();
        assert!(missing_browser.starts_with("BUNDLED_BROWSER_MISSING:"));
        std::fs::remove_file(directory.join("node.exe")).unwrap();
        std::fs::create_dir(directory.join("node.exe")).unwrap();
        std::fs::create_dir(directory.join("ms-playwright")).unwrap();
        assert!(super::bundled_windows_runtime(&worker)
            .unwrap_err()
            .starts_with("BUNDLED_NODE_MISSING:"));
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn watchdog_grace_is_bounded_by_the_host_hard_limit() {
        assert_eq!(super::sidecar_watchdog_sec(60), 210);
        assert_eq!(super::sidecar_watchdog_sec(600), 750);
        assert_eq!(super::sidecar_watchdog_sec(1500), 1650);
        assert_eq!(super::sidecar_watchdog_sec(u64::MAX), 1650);
    }

    #[tokio::test]
    async fn watchdog_preserves_artifacts_written_after_worker_budget() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            chrono::Utc::now().to_rfc3339(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let artifact = std::env::temp_dir().join(format!("krds-watchdog-{id}.json"));
        let path = artifact.to_str().unwrap();
        #[cfg(not(windows))]
        let argv = [
            "sh",
            "-c",
            "sleep 2; printf '%s' '{\"completedPages\":1}' > \"$1\"",
            "watchdog",
            path,
        ];
        #[cfg(windows)]
        let script = format!(
            "Start-Sleep -Seconds 2; [IO.File]::WriteAllText('{}', '{{\"completedPages\":1}}')",
            path.replace('\'', "''")
        );
        #[cfg(windows)]
        let argv = [
            "powershell",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script.as_str(),
        ];
        registry.spawn_sidecar_for_test(&id, &argv).await.unwrap();
        let outcome = registry
            .wait_sidecar_with_watchdog(&id, std::sync::Arc::new(|_| {}), 1)
            .await;
        match outcome {
            super::SessionOutcome::Succeeded { .. } => {}
            super::SessionOutcome::Failed { detail } => {
                panic!("late worker artifact lost: {detail}")
            }
            super::SessionOutcome::Cancelled => panic!("late worker artifact cancelled"),
        }
        let saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&artifact).unwrap()).unwrap();
        std::fs::remove_file(artifact).unwrap();
        assert_eq!(saved, serde_json::json!({"completedPages": 1}));
    }

    #[tokio::test]
    async fn cancel_unknown_session_returns_false() {
        let registry = SessionRegistry::shared();
        let done = registry
            .cancel("no-such-session", "2026-10-01T00:00:00Z".to_string())
            .await;
        assert!(!done);
    }

    #[tokio::test]
    async fn cancel_known_session_marks_cancelled_without_child() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let done = registry
            .cancel(&id, "2026-10-01T00:01:00Z".to_string())
            .await;
        assert!(done);
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        assert_eq!(snapshot["hasResult"], false);
        assert!(registry.validated_export_text(&id).await.is_err());
        assert_eq!(
            registry
                .spawn_sidecar(&id, "missing-worker.mjs", &[])
                .await
                .unwrap_err(),
            "session cancelled before worker startup"
        );
    }

    #[tokio::test]
    async fn cancel_after_success_does_not_reopen_session() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:01:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let corpus: serde_json::Value = serde_json::from_str(include_str!(
            "../../packages/contracts/test/fixtures/official-conformance.json"
        ))
        .unwrap();
        registry
            .store_result(
                &id,
                corpus["valid"].to_string(),
                "{}".to_string(),
                "{}".to_string(),
                "2026-10-01T00:02:00Z".to_string(),
            )
            .await;
        assert!(
            registry
                .cancel(&id, "2026-10-01T00:03:00Z".to_string())
                .await
        );
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "succeeded");
    }

    #[tokio::test]
    async fn warp_failure_retains_official_bytes_and_reopens_failed() {
        let root = std::env::temp_dir().join(format!("warp-case-{}", uuid::Uuid::new_v4()));
        let registry = SessionRegistry::persistent(root.clone()).unwrap();
        let corpus: serde_json::Value = serde_json::from_str(include_str!("../../packages/contracts/test/fixtures/official-conformance.json")).unwrap();
        let official = corpus["valid"].to_string();
        let mut record = new_session("https://example.kr/".into(), "2026-10-01T00:01:00Z".into());
        let id = record.id.clone();
        record.warp_failure = Some(crate::warp::WarpFailureCode::TunnelExited);
        record.settings = serde_json::json!({"transport":{"kind":"warp","backend":"usque","version":"4.2.1"}});
        registry.insert(record).await;
        assert!(registry.store_result(&id, official.clone(), "{}".into(), "{}".into(), "2026-10-01T00:02:00Z".into()).await);
        assert_eq!(registry.snapshot(&id).await.unwrap()["status"], "failed");
        assert_eq!(std::fs::read_to_string(root.join(&id).join("result.json")).unwrap(), official);
        drop(registry);
        let reopened = SessionRegistry::persistent(root.clone()).unwrap();
        let case = reopened.open_case(&id).await.unwrap();
        assert_eq!(case["manifest"]["status"], "failed");
        assert_eq!(case["manifest"]["settings"]["transportFailure"], serde_json::json!({"code":"tunnel-exited","scope":"incomplete"}));
        assert_eq!(reopened.snapshot(&id).await.unwrap()["status"], "failed");
        assert_eq!(reopened.validated_export_text(&id).await.unwrap(), official);
        assert_eq!(reopened.case_store().unwrap().save_review(&id, 0, vec![]).unwrap().revision, 1);
        assert_eq!(reopened.open_case(&id).await.unwrap()["review"]["revision"], 1);
        let manifest_path = root.join(&id).join("manifest.json");
        let mut manifest: serde_json::Value = serde_json::from_slice(&std::fs::read(&manifest_path).unwrap()).unwrap();
        manifest["settings"]["transport"]["token"] = serde_json::json!("private-fixture");
        std::fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert!(reopened.open_case(&id).await.is_err());
        assert_eq!(std::fs::read_to_string(root.join(&id).join("result.json")).unwrap(), official);
        drop(reopened);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[ignore = "local owned metadata child fixture"]
    fn warp_metadata_child() {
        eprintln!("KRDSTRANSPORT {}", "private-fixture".repeat(6000));
        eprintln!("KRDSTRANSPORT {{\"kind\":\"warp\",\"backend\":\"usque\",\"version\":\"4.2.1\",\"token\":\"private-fixture\"}}");
        eprintln!("prefix KRDSTRANSPORT private-fixture");
        eprintln!("KRDSTRANSPORT {{\"kind\":\"direct\",\"reason\":\"owned-origin\"}}");
        eprintln!("KRDSTRANSPORT {{\"kind\":\"warp\",\"backend\":\"usque\",\"version\":\"4.2.1\"}}");
        eprintln!("KRDSWARPERROR {{\"code\":\"tunnel-exited\",\"token\":\"private-fixture\"}}");
        eprintln!("KRDSWARPERROR {{\"code\":\"tunnel-exited\"}}");
        std::process::exit(1);
    }

    #[tokio::test]
    async fn warp_owned_pipe_accepts_only_bounded_metadata_without_diagnostic_leak() {
        let registry = SessionRegistry::shared();
        let record = new_session("https://example.kr/".into(), "2026-10-01T00:00:00Z".into());
        let other = new_session("https://example.kr/".into(), "2026-10-01T00:00:00Z".into());
        let id = record.id.clone(); let other_id = other.id.clone();
        registry.insert(record).await; registry.insert(other).await;
        let executable = std::env::current_exe().unwrap();
        registry.spawn_sidecar_for_test(&id, &[executable.to_str().unwrap(), "--exact", "session::tests::warp_metadata_child", "--ignored", "--nocapture"]).await.unwrap();
        let outcome = registry.wait_sidecar_with_progress(&id, std::sync::Arc::new(|_| {})).await;
        let super::SessionOutcome::Failed {detail} = outcome else {panic!("fixture must fail")};
        assert_eq!(detail, "tunnel-exited");
        let guard = registry.inner.lock().await;
        assert_eq!(guard[&id].settings, serde_json::json!({"transport":{"kind":"direct","reason":"owned-origin"}}));
        assert_eq!(guard[&id].warp_failure, Some(crate::warp::WarpFailureCode::TunnelExited));
        assert_eq!(guard[&other_id].settings, serde_json::json!({}));
        assert_eq!(guard[&other_id].warp_failure, None);
    }

    #[tokio::test]
    async fn late_success_after_cancel_does_not_overwrite() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:01:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        assert!(
            registry
                .cancel(&id, "2026-10-01T00:02:00Z".to_string())
                .await
        );
        registry
            .store_result(
                &id,
                "{\"meta\":{},\"findings\":[]}\n".to_string(),
                "{}".to_string(),
                "{}".to_string(),
                "2026-10-01T00:03:00Z".to_string(),
            )
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        assert!(registry.result_value(&id).await.is_none());
    }

    #[tokio::test]
    async fn valid_official_export_survives_missing_optional_evidence() {
        let registry = SessionRegistry::shared();
        let record = new_session("https://example.kr/".into(), "2026-10-01T00:00:00Z".into());
        let id = record.id.clone();
        registry.insert(record).await;
        let official = serde_json::json!({"meta":{"topic":"TOPIC","entry_url":"https://example.kr/","started_at":"2026-10-01T00:00:00Z","finished_at":"2026-10-01T00:01:00Z","elapsed_sec":60,"tool_version":"0.1.0"},"findings":[{"id":"f1","url":"https://example.kr/","location":"#ad","technique":"OFFSCREEN","is_violation":true,"evidence_text":"카지노 가입"}]}).to_string();
        registry
            .store_result(
                &id,
                official,
                "{broken".into(),
                "{broken".into(),
                "2026-10-01T00:01:00Z".into(),
            )
            .await;
        assert_eq!(registry.snapshot(&id).await.unwrap()["hasResult"], true);
        let exported = registry.validated_export_text(&id).await.unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&exported).unwrap()["findings"][0]
                ["evidence_text"],
            "카지노 가입"
        );
    }

    #[tokio::test]
    async fn store_result_round_trips_through_result_value() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let canonical = "{\"meta\":{\"topic\":\"TOPIC\",\"entry_url\":\"https://example.kr/\",\"started_at\":\"2026-10-01T00:00:00Z\",\"finished_at\":\"2026-10-01T00:01:00Z\",\"elapsed_sec\":60,\"tool_version\":\"0.1.0\"},\"findings\":[]}\n";
        registry
            .record_progress(
                &id,
                &serde_json::json!({"sequence": 1, "visitedPages": 3, "confirmedFindings": 2}),
            )
            .await;
        registry
            .store_result(
                &id,
                canonical.to_string(),
                "{}".to_string(),
                "{}".to_string(),
                "2026-10-01T00:01:00Z".to_string(),
            )
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "succeeded");
        let value = registry.result_value(&id).await.expect("result value");
        assert!(value["findings"].as_array().is_some_and(|f| f.is_empty()));
        let text = registry
            .validated_export_text(&id)
            .await
            .expect("validated export text");
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&text).unwrap(),
            value
        );
        let progress = registry.progress_snapshot(&id).await;
        assert_eq!(progress.pages, 3);
        assert_eq!(
            progress.findings, 0,
            "validated result count overrides worker progress"
        );
    }

    #[tokio::test]
    async fn fail_marks_session_failed_with_detail() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        registry
            .fail(
                &id,
                "sidecar exited 1: boom".to_string(),
                "2026-10-01T00:01:00Z".to_string(),
            )
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "failed");
        assert!(registry.result_value(&id).await.is_none());
    }

    #[tokio::test]
    async fn cancel_with_live_child_terminates_and_stays_cancelled() {
        let (child, _guard) = super::test_support::spawn_sleeper().await;
        let registry = SessionRegistry::shared();
        let mut record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let pid = child.id().unwrap_or(0);
        record.child = Some(child);
        record.child_pid = Some(pid);
        let id = record.id.clone();
        registry.insert(record).await;
        // Waiter observes natural exit in the background while cancel races it.
        let waiter = {
            let registry = registry.inner_clone();
            let id = id.clone();
            tokio::spawn(async move { registry.wait_sidecar(&id).await })
        };
        assert!(
            registry
                .cancel(&id, "2026-10-01T00:01:00Z".to_string())
                .await
        );
        let outcome = waiter.await.expect("waiter joins");
        assert!(matches!(outcome, super::SessionOutcome::Cancelled));
        assert_eq!(
            registry.snapshot(&id).await.unwrap()["status"],
            "finalizing"
        );
        registry
            .complete_cancellation(&id, None, None, "finish".to_string())
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        // Host survives the kill; registry still serves reads.
        assert!(registry.snapshot("no-such-session").await.is_none());
    }

    #[tokio::test]
    async fn cancel_during_exit_never_completes_as_succeeded() {
        // The waiter takes the Child on natural exit; cancel takes it on
        // cancel. Whoever takes it first owns the terminal state: if cancel
        // takes it, the waiter must report Cancelled and store_result must
        // refuse the late success (OBSERVED on VM: cancel landed but the
        // scan still showed succeeded 17/17).
        let (child, _guard) = super::test_support::spawn_sleeper().await;
        let registry = SessionRegistry::shared();
        let mut record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let pid = child.id().unwrap_or(0);
        record.child = Some(child);
        record.child_pid = Some(pid);
        let id = record.id.clone();
        registry.insert(record).await;
        let waiter = {
            let registry = registry.inner_clone();
            let id = id.clone();
            tokio::spawn(async move { registry.wait_sidecar(&id).await })
        };
        // Cancel immediately: with the Child taken under the lock, the
        // waiter cannot reap it as a natural exit.
        assert!(
            registry
                .cancel(&id, "2026-10-01T00:01:00Z".to_string())
                .await
        );
        let outcome = waiter.await.expect("waiter joins");
        assert!(matches!(outcome, super::SessionOutcome::Cancelled));
        // A late success arriving after cancel must not flip the session.
        registry
            .complete_cancellation(&id, None, None, "finish".to_string())
            .await;
        registry
            .store_result(
                &id,
                "{\"meta\":{},\"findings\":[]}\n".to_string(),
                "{}".to_string(),
                "{}".to_string(),
                "2026-10-01T00:02:00Z".to_string(),
            )
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        assert!(registry.result_value(&id).await.is_none());
    }

    #[test]
    fn status_strings_match_contract() {
        assert_eq!(SessionStatus::Running.as_str(), "running");
        assert_eq!(SessionStatus::Cancelled.as_str(), "cancelled");
        assert_eq!(SessionStatus::Failed.as_str(), "failed");
    }
}

/// Test-only process helpers: real child processes (sleep), never mocks.
/// `spawn_sleeper` returns a live Child + a guard keeping it in its own
/// process group so the test never kills the test runner itself.
#[cfg(test)]
pub mod test_support {
    /// Spawn a real long-lived child the registry can kill.
    pub async fn spawn_sleeper() -> (tokio::process::Child, SleeperGuard) {
        #[cfg(windows)]
        let mut cmd = {
            let mut c = tokio::process::Command::new("powershell");
            c.args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Start-Sleep -Seconds 120",
            ]);
            c
        };
        #[cfg(not(windows))]
        let mut cmd = {
            let mut c = tokio::process::Command::new("sleep");
            c.args(["120"]);
            c
        };
        cmd.stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        let child = cmd.spawn().expect("sleeper spawns");
        (child, SleeperGuard)
    }

    pub struct SleeperGuard;
}

#[cfg(test)]
mod progress_pump_tests {
    use super::{new_session, ProgressSink, SessionRegistry};
    use std::sync::Arc;

    fn event_json(kind: &str, pages: u64, url: &str) -> String {
        format!(
            "KRDSPROGRESS {{\"kind\":\"{kind}\",\"message\":null,\"pageUrl\":\"{url}\",\"progress\":{{\"sequence\":{pages},\"visitedPages\":{pages},\"failedPages\":0,\"queuedPages\":1,\"currentPages\":[],\"recentActivity\":[],\"framesInspected\":2,\"elementsAnalyzed\":11,\"candidates\":4,\"confirmedFindings\":2,\"elapsedSec\":5,\"stage\":\"running\"}}}}"
        )
    }

    #[tokio::test]
    async fn polling_recovers_active_work_and_terminal_settlement_clears_it() {
        let registry = SessionRegistry::shared();
        let record = new_session("https://example.kr/".to_string(), "start".to_string());
        let id = record.id.clone();
        registry.insert(record).await;
        let progress = serde_json::json!({
            "sequence": 8, "visitedPages": 12, "failedPages": 2, "queuedPages": 6,
            "currentPages": ["https://example.kr/a", "https://example.kr/b"],
            "recentActivity": [{"sequence": 8, "kind": "page-failed", "stage": "running", "elapsedSec": 10}],
            "confirmedFindings": 3, "elapsedSec": 12,
        });
        assert!(registry.record_progress(&id, &progress).await);
        assert!(
            !registry
                .record_progress(&id, &serde_json::json!({"sequence": 7, "visitedPages": 1}))
                .await
        );
        let session = registry.snapshot(&id).await.unwrap();
        assert_eq!(
            session["progress"]["currentPages"],
            progress["currentPages"]
        );
        assert_eq!(
            session["progress"]["recentActivity"],
            progress["recentActivity"]
        );
        assert_eq!(session["progress"]["visitedPages"], 12);
        assert_eq!(session["progress"]["failedPages"], 2);
        assert_eq!(session["progress"]["queuedPages"], 6);
        registry.cancel(&id, "finish".to_string()).await;
        let terminal = registry.snapshot(&id).await.unwrap();
        assert_eq!(terminal["progress"]["sequence"], 9);
        assert_eq!(terminal["progress"]["visitedPages"], 12);
        assert_eq!(terminal["progress"]["confirmedFindings"], 3);
        assert_eq!(terminal["progress"]["currentPages"], serde_json::json!([]));
        assert_eq!(terminal["progress"]["queuedPages"], 0);
        assert!(
            !registry
                .record_progress(
                    &id,
                    &serde_json::json!({"sequence": 10, "visitedPages": 99})
                )
                .await
        );
    }

    /// Stderr fragments for the pump child, rendered per platform.
    enum PumpLines {
        #[cfg(not(windows))]
        Sh(Vec<String>),
        #[cfg(windows)]
        PowerShell(Vec<String>),
    }

    impl PumpLines {
        /// Pick the variant matching the test target: `sh` fragments on
        /// unix, `[Console]::Error` fragments on Windows (`sh` is absent
        /// there — OBSERVED via `program not found`).
        fn for_target(sh: Vec<String>, ps: Vec<String>) -> Self {
            #[cfg(windows)]
            {
                let _ = sh;
                PumpLines::PowerShell(ps)
            }
            #[cfg(not(windows))]
            {
                let _ = ps;
                PumpLines::Sh(sh)
            }
        }
    }

    async fn run_pump(
        lines: PumpLines,
    ) -> (
        Vec<serde_json::Value>,
        super::SessionOutcome,
        super::ProgressSnapshot,
    ) {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        #[cfg(not(windows))]
        let argv: Vec<String> = match lines {
            PumpLines::Sh(fragments) => {
                vec!["sh".to_string(), "-c".to_string(), fragments.join("; ")]
            }
        };
        #[cfg(windows)]
        let argv: Vec<String> = match lines {
            PumpLines::PowerShell(fragments) => vec![
                "powershell".to_string(),
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                fragments.join("; "),
            ],
        };
        let argv_refs: Vec<&str> = argv.iter().map(String::as_str).collect();
        registry
            .spawn_sidecar_for_test(&id, &argv_refs)
            .await
            .expect("test child spawns");
        let seen = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let capture = seen.clone();
        let sink: ProgressSink = Arc::new(move |event| {
            capture.lock().expect("sink mutex").push(event);
        });
        let outcome = registry.wait_sidecar_with_progress(&id, sink).await;
        let events = seen.lock().expect("sink mutex").clone();
        let snapshot = registry.progress_snapshot(&id).await;
        (events, outcome, snapshot)
    }

    #[tokio::test]
    async fn terminal_worker_events_are_not_forwarded() {
        let line = |kind: &str, pages: u64| {
            let payload = event_json(kind, pages, "https://example.kr/a");
            #[cfg(windows)]
            {
                format!("[Console]::Error.WriteLine('{payload}')")
            }
            #[cfg(not(windows))]
            {
                format!("echo '{payload}' >&2")
            }
        };
        let (events, _, snapshot) = run_pump(PumpLines::for_target(
            vec![
                format!(
                    "echo '{}' >&2",
                    event_json("page-visited", 3, "https://example.kr/a")
                ),
                format!(
                    "echo '{}' >&2",
                    event_json("session-finished", 9, "https://example.kr/a")
                ),
                format!(
                    "echo '{}' >&2",
                    event_json("session-failed", 9, "https://example.kr/a")
                ),
                format!(
                    "echo '{}' >&2",
                    event_json("session-cancelled", 0, "https://example.kr/a")
                ),
            ],
            vec![
                line("page-visited", 3),
                line("session-finished", 9),
                line("session-failed", 9),
                line("session-cancelled", 0),
            ],
        ))
        .await;
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["kind"], "page-visited");
        assert_eq!(events[0]["progress"]["visitedPages"], 3);
        assert_eq!(
            snapshot.pages, 3,
            "host terminal progress must retain the last real page count"
        );
        let terminal = snapshot.terminal_value("failed");
        assert_eq!(terminal["visitedPages"], 3);
        assert_eq!(terminal["queuedPages"], 0);
        assert_eq!(terminal["framesInspected"], 2);
        assert_eq!(terminal["elementsAnalyzed"], 11);
        assert_eq!(terminal["candidates"], 4);
        assert_eq!(terminal["confirmedFindings"], 2);
        assert_eq!(terminal["elapsedSec"], 5.0);
        assert_eq!(terminal["stage"], "failed");
    }

    #[tokio::test]
    async fn malformed_and_plain_lines_do_not_break_forwarding() {
        let (events, _, _) = run_pump(PumpLines::for_target(
            vec![
                "echo 'worker starting' >&2".to_string(),
                "echo 'KRDSPROGRESS not-json' >&2".to_string(),
                format!(
                    "echo '{}' >&2",
                    event_json("page-visited", 2, "https://example.kr/b")
                ),
            ],
            vec![
                "[Console]::Error.WriteLine('worker starting')".to_string(),
                "[Console]::Error.WriteLine('KRDSPROGRESS not-json')".to_string(),
                format!(
                    "[Console]::Error.WriteLine('{}')",
                    event_json("page-visited", 2, "https://example.kr/b")
                ),
            ],
        ))
        .await;
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["progress"]["visitedPages"], 2);
    }

    #[tokio::test]
    async fn stderr_only_failure_carries_diagnostics() {
        let (_, outcome, _) = run_pump(PumpLines::for_target(
            vec!["echo 'boom-detail' >&2".to_string(), "exit 3".to_string()],
            vec!["[Console]::Error.WriteLine('boom-detail'); exit 3".to_string()],
        ))
        .await;
        match outcome {
            super::SessionOutcome::Failed { detail } => {
                assert!(detail.contains("boom-detail"), "detail was: {detail}");
            }
            _ => panic!("expected failed outcome"),
        }
    }

    #[tokio::test]
    async fn large_output_does_not_hang_or_flood() {
        let (events, _, _) = run_pump(PumpLines::for_target(
            vec![
                "for i in $(seq 1 500); do echo \"KRDSPROGRESS-noise-$i\" >&2; done".to_string(),
                "echo 'done-marker' >&2".to_string(),
            ],
            vec![
                "for ($i = 1; $i -le 500; $i++) { [Console]::Error.WriteLine(\"KRDSPROGRESS-noise-$i\") }".to_string(),
                "[Console]::Error.WriteLine('done-marker')".to_string(),
            ],
        ))
        .await;
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn cancel_under_output_load_keeps_ownership() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        #[cfg(windows)]
        let argv: Vec<String> = vec![
            "powershell".to_string(),
            "-NoProfile".to_string(),
            "-NonInteractive".to_string(),
            "-Command".to_string(),
            "for ($i = 1; $i -le 100000; $i++) { [Console]::Error.WriteLine(\"line-$i\") }; Start-Sleep -Seconds 30".to_string(),
        ];
        #[cfg(not(windows))]
        let argv: Vec<String> = vec![
            "sh".to_string(),
            "-c".to_string(),
            "for i in $(seq 1 100000); do echo line-$i >&2; done; sleep 30".to_string(),
        ];
        let argv_refs: Vec<&str> = argv.iter().map(String::as_str).collect();
        registry
            .spawn_sidecar_for_test(&id, &argv_refs)
            .await
            .expect("load child spawns");
        let sink: ProgressSink = Arc::new(|_| {});
        let waiter = {
            let registry = registry.inner_clone();
            let id = id.clone();
            tokio::spawn(async move { registry.wait_sidecar_with_progress(&id, sink).await })
        };
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        assert!(
            registry
                .cancel(&id, "2026-10-01T00:01:00Z".to_string())
                .await
        );
        let outcome = waiter.await.expect("waiter joins");
        assert!(matches!(outcome, super::SessionOutcome::Cancelled));
        assert_eq!(
            registry.snapshot(&id).await.unwrap()["status"],
            "finalizing"
        );
        registry
            .complete_cancellation(&id, None, None, "finish".to_string())
            .await;
        let snapshot = registry.snapshot(&id).await.expect("snapshot");
        assert_eq!(snapshot["status"], "cancelled");
    }
}
