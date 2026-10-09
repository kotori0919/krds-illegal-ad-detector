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

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::evidence::SessionEvidence;

fn sidecar_watchdog_sec(worker_timeout_sec: u64) -> u64 {
    worker_timeout_sec.saturating_add(150).min(1650)
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

/// Session-state owner for the Job guard. JobGuard itself is Send+Sync
/// (see job.rs); this wrapper names the ownership role.
pub(crate) struct SendJobGuard(JobGuard);

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
    pub job: Option<SendJobGuard>,
    pub result_json: Option<String>,
    evidence: Option<SessionEvidence>,
    pub extra_json: Option<String>,
    pub progress: ProgressSnapshot,
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
        }
    }

    /// Kill the owned child process tree; safe to call repeatedly.
    /// The Job guard (Windows) kills the whole tree on drop even if the
    /// direct child already exited — cancel never depends on wait state.
    pub async fn kill_child(&mut self) {
        if let Some(mut child) = self.child.take() {
            // Best-effort direct kill first so waiters observe exit fast.
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
        self.child_pid = None;
        self.job.take();
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
            recent_activity.insert(0, serde_json::json!({"sequence": self.sequence + 1,
                "kind": kind, "stage": stage, "elapsedSec": self.elapsed_sec}));
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
}

impl SessionRegistry {
    #[must_use]
    pub fn shared() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn inner_clone(self: &Arc<Self>) -> Arc<Self> {
        Arc::clone(self)
    }

    pub async fn insert(&self, record: SessionRecord) {
        self.inner.lock().await.insert(record.id.clone(), record);
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
        if record.cancel_requested { return true; }
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
            }).await;
        }
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(10);
        loop {
            let mut guard = self.inner.lock().await;
            let Some(record) = guard.get_mut(session_id) else { return false; };
            let Some(child) = record.child.as_mut() else { break; };
            if matches!(child.try_wait(), Ok(Some(_))) { break; }
            if tokio::time::Instant::now() >= deadline {
                record.kill_child().await;
                break;
            }
            drop(guard);
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        true
    }

    pub async fn cancellation_requested(&self, session_id: &str) -> bool {
        self.inner.lock().await.get(session_id).is_some_and(|record| record.cancel_requested)
    }

    /// Store only a fully validated partial bundle, then publish cancellation.
    pub async fn complete_cancellation(&self, session_id: &str, bundle: Option<(String, String, String)>, error: Option<String>, finished_at: String) {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else { return; };
        if !record.cancel_requested { return; }
        if let Some((canonical, detail, extra)) = bundle {
            record.progress.findings = serde_json::from_str::<serde_json::Value>(&canonical).ok()
                .and_then(|value| value["findings"].as_array().map(|items| items.len() as u64)).unwrap_or(0);
            record.result_json = Some(canonical);
            record.evidence = SessionEvidence::from_json(&detail).ok();
            record.extra_json = Some(extra);
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
        let Some(record) = guard.get_mut(session_id) else { return false; };
        if matches!(record.status, SessionStatus::Succeeded | SessionStatus::Failed | SessionStatus::Cancelled) {
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
        let Some(record) = guard.get_mut(session_id) else { return false; };
        if record.cancel_requested { return false; }
        record.child_pid = None;
        record.status = SessionStatus::Failed;
        record.finished_at = Some(finished_at);
        record.error = Some("scan deadline reached; worker process stopped".to_string());
        true
    }

    pub async fn store_result(&self, session_id: &str, canonical: String, detail_json: String, extra_json: String, finished_at: String) -> bool {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        // Never overwrite a terminal cancel/fail with a late success.
        if record.cancel_requested || matches!(record.status, SessionStatus::Cancelled | SessionStatus::Failed) {
            return false;
        }
        record.result_json = Some(canonical);
        if let Some(count) = record.result_json.as_deref()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
            .and_then(|value| value.get("findings").and_then(serde_json::Value::as_array).map(|items| items.len() as u64)) {
            record.progress.findings = count;
        }
        record.evidence = SessionEvidence::from_json(&detail_json).ok();
        record.extra_json = Some(extra_json);
        record.status = SessionStatus::Succeeded;
        record.finished_at = Some(finished_at);
        record.error = None;
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
            "hasResult": record.result_json.is_some() && record.evidence.is_some() && record.extra_json.is_some(),
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
        Some(self.inner.lock().await.get(session_id)?.evidence.as_ref()?.coverage())
    }

    pub async fn finding_detail_value(&self, session_id: &str, finding_id: &str) -> Option<serde_json::Value> {
        self.inner.lock().await.get(session_id)?.evidence.as_ref()?.finding(finding_id)
    }

    pub async fn evidence_asset_value(&self, session_id: &str, asset_id: &str) -> Option<serde_json::Value> {
        self.inner.lock().await.get(session_id)?.evidence.as_ref()?.asset(asset_id)
    }

    pub async fn evidence_summary_value(&self, session_id: &str) -> Option<serde_json::Value> {
        Some(self.inner.lock().await.get(session_id)?.evidence.as_ref()?.summary())
    }

    pub async fn image_analysis_value(&self, session_id: &str, query: &serde_json::Value) -> Result<Option<serde_json::Value>, String> {
        let guard = self.inner.lock().await;
        let Some(index) = guard.get(session_id).and_then(|record|record.evidence.as_ref()) else { return Ok(None); };
        index.images(query).map(Some)
    }

    pub async fn evidence_graph_value(&self, session_id: &str, query: &serde_json::Value) -> Result<Option<serde_json::Value>, String> {
        let guard = self.inner.lock().await;
        let Some(index) = guard.get(session_id).and_then(|record|record.evidence.as_ref()) else { return Ok(None); };
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
        if !matches!(record.status, SessionStatus::Succeeded | SessionStatus::Cancelled)
            || record.evidence.is_none() || record.extra_json.is_none() {
            return Err("no validated result stored for session yet".to_string());
        }
        let text = record.result_json.as_deref().ok_or("no result stored for session yet")?;
        validate_sidecar_stdout(&record.entry_url, text)
            .map_err(|error| format!("stored result invalid, export blocked: {error}"))
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
                value.get("findings")
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
        let Some(record) = guard.get_mut(session_id) else { return false; };
        if matches!(record.status, SessionStatus::Succeeded | SessionStatus::Cancelled | SessionStatus::Failed) {
            return false;
        }
        let snapshot = &mut record.progress;
        let count = |field: &str| progress.get(field).and_then(serde_json::Value::as_u64);
        let Some(sequence) = count("sequence") else { return false; };
        if sequence <= snapshot.sequence { return false; }
        snapshot.sequence = sequence;
        if let Some(value) = count("queuedPages") { snapshot.queued_pages = value; }
        if let Some(value) = count("failedPages") { snapshot.failed_pages = snapshot.failed_pages.max(value); }
        snapshot.current_pages = progress.get("currentPages").and_then(serde_json::Value::as_array)
            .map(|items| items.iter().filter_map(serde_json::Value::as_str).take(4).map(str::to_owned).collect())
            .unwrap_or_default();
        snapshot.recent_activity = progress.get("recentActivity").and_then(serde_json::Value::as_array)
            .map(|items| items.iter().take(5).cloned().collect()).unwrap_or_default();
        if progress.get("stage").and_then(serde_json::Value::as_str) == Some("finalizing") {
            record.status = SessionStatus::Finalizing;
        }
        if let Some(value) = count("visitedPages") { snapshot.pages = snapshot.pages.max(value); }
        if let Some(value) = count("framesInspected") { snapshot.frames_inspected = snapshot.frames_inspected.max(value); }
        if let Some(value) = count("elementsAnalyzed") { snapshot.elements_analyzed = snapshot.elements_analyzed.max(value); }
        if let Some(value) = count("candidates") { snapshot.candidates = snapshot.candidates.max(value); }
        if let Some(value) = count("confirmedFindings") { snapshot.findings = snapshot.findings.max(value); }
        if let Some(value) = progress.get("elapsedSec").and_then(serde_json::Value::as_f64) {
            if value.is_finite() { snapshot.elapsed_sec = snapshot.elapsed_sec.max(value); }
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
        ).await {
            Ok(outcome) => outcome,
            Err(_) => {
                if self.terminate_at_deadline(session_id, chrono::Utc::now().to_rfc3339()).await {
                    SessionOutcome::Failed { detail: "scan deadline reached; worker process stopped".to_string() }
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
        use tokio::io::{AsyncBufReadExt, BufReader};
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
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Some(payload) = line.split_once("KRDSPROGRESS ") {
                    let Ok(value) = serde_json::from_str::<serde_json::Value>(payload.1) else {
                        continue;
                    };
                    let kind = value.get("kind").and_then(|k| k.as_str()).unwrap_or("stage-changed");
                    // Terminal events are the worker's opinion, not the
                    // host's verdict: drop them here, finish_session emits.
                    if matches!(kind, "session-finished" | "session-failed" | "session-cancelled") {
                        continue;
                    }
                    let Some(progress) = value.get("progress").cloned() else { continue; };
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
        if tokio::time::timeout(std::time::Duration::from_secs(5), &mut pump).await.is_err() {
            pump.abort();
            let _ = pump.await;
        }
        match outcome {
            SessionOutcome::Failed { detail } => {
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


    /// Wait for the owned sidecar child WITHOUT removing it from the record:
    /// the Child stays registered so `cancel` can always kill it. Poll via
    /// brief lock acquisitions; terminal reaping (taking Child + Job)
    /// happens exactly once — here on natural exit, or in `cancel`.
    pub async fn wait_sidecar(&self, session_id: &str) -> SessionOutcome {
        loop {
            enum Poll { Failed(String), Running, Exited }
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
                        let detail = record.error.clone().unwrap_or_else(|| "sidecar missing".to_string());
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
    async fn collect_output(
        child: tokio::process::Child,
        session_id: &str,
    ) -> SessionOutcome {
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
            if record.cancel_requested { return Err("session cancelled before worker startup".to_string()); }
        }
        // The resource worker resolves npm packages relative to its own path.
        // Keep Node and its browser beside that worker in installed bundles.
        // The executable-adjacent layout remains valid for portable runs.
        #[cfg(windows)]
        let worker_dir = std::path::Path::new(sidecar_path).parent();
        #[cfg(windows)]
        let host_dir = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(std::path::Path::to_path_buf));
        #[cfg(windows)]
        let node_bin = worker_dir
            .map(|dir| dir.join("node.exe"))
            .filter(|p| p.is_file())
            .or_else(|| host_dir.as_ref().map(|dir| dir.join("node.exe")).filter(|p| p.is_file()))
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "node".to_string());
        #[cfg(not(windows))]
        let node_bin = "node".to_string();
        let mut cmd = std::process::Command::new(&node_bin);
        cmd.arg(sidecar_path);
        // Browser resolution follows the worker resource first, then the
        // portable executable layout, then Playwright's per-user cache.
        // Never hard-code a user profile path.
        #[cfg(windows)]
        {
            let shell_dir = std::env::var_os("PLAYWRIGHT_BROWSERS_PATH")
                .map(std::path::PathBuf::from)
                .filter(|p| p.is_dir())
                .or_else(|| worker_dir.map(|d| d.join("ms-playwright")).filter(|p| p.is_dir()))
                .or_else(|| host_dir.map(|d| d.join("ms-playwright")).filter(|p| p.is_dir()));
            if let Some(dir) = shell_dir {
                cmd.env("PLAYWRIGHT_BROWSERS_PATH", dir);
            } else {
                cmd.env_remove("PLAYWRIGHT_BROWSERS_PATH");
            }
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
            record.job = Some(SendJobGuard(job));
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
    pub async fn spawn_sidecar_for_test(&self, session_id: &str, argv: &[&str]) -> Result<u32, String> {
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
        let record = guard.get_mut(session_id).ok_or_else(|| "unknown session".to_string())?;
        record.child = Some(child);
        record.child_pid = Some(pid);
        Ok(pid)
    }

}

pub fn new_session(entry_url: String, started_at: String) -> SessionRecord {
    let id = uuid::Uuid::new_v4().to_string();
    SessionRecord::new(id, entry_url, started_at)
}

/// Cancellation can arrive after a natural worker exit. Validate its completed
/// artifacts identically, then mark coverage with the host's cancellation verdict.
pub(crate) fn load_cancelled_bundle(entry_url: &str, result_path: &std::path::Path, detail_path: &std::path::Path, extra_path: &std::path::Path) -> Result<(String, String, String), String> {
    let result = std::fs::read_to_string(result_path).map_err(|e| format!("partial result missing: {e}"))?;
    let detail = std::fs::read_to_string(detail_path).map_err(|e| format!("partial detail missing: {e}"))?;
    let extra = std::fs::read_to_string(extra_path).map_err(|e| format!("partial extra result missing: {e}"))?;
    let canonical = validate_sidecar_stdout(entry_url, &result)?;
    validate_extra_bundle(&canonical, &extra)?;
    validate_detail_bundle(&canonical, &detail, &extra)?;
    let mut parsed: serde_json::Value = serde_json::from_str(&detail).map_err(|e| e.to_string())?;
    if parsed["coverage"]["checkedPages"].as_u64().unwrap_or(0) == 0 {
        return Err("no completed page result to retain".to_string());
    }
    parsed["coverage"]["cancelled"] = serde_json::json!(true);
    let retained_detail = serde_json::to_string(&parsed).map_err(|e| e.to_string())?;
    Ok((canonical, retained_detail, extra))
}

/// BOM-free UTF-8, valid JSON, complete meta, required finding fields,
/// official technique enum only, unique ids, no duplicate
/// url+location+technique identities, and request/result entry_url match.
/// Any violation fails the session and is never exportable (KODEX §38).
pub(crate) fn validate_sidecar_stdout(entry_url: &str, stdout: &str) -> Result<String, String> {
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
pub(crate) fn validate_detail_bundle(official_text: &str, detail_text: &str, extra_text: &str) -> Result<(), String> {
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
        if let Some(selector) = item["observed"].get("selector") {
            if selector.as_str().is_none_or(str::is_empty) { return Err(format!("detail {id} observed selector invalid")); }
        }
        let visual = &item["visual"];
        match visual["state"].as_str() {
            Some("available") => {
                let uri = visual["dataUrl"].as_str().ok_or(format!("detail {id} visual data missing"))?;
                if !uri.starts_with("data:image/jpeg;base64,") || uri.len() > 700_000 {
                    return Err(format!("detail {id} visual data invalid"));
                }
                let valid_box = |rect: &serde_json::Value| {
                    ["x", "y", "width", "height"].iter().all(|key|
                        rect[*key].as_f64().map(|value| value.is_finite()).unwrap_or(false))
                        && rect["width"].as_f64().unwrap_or(0.0) > 0.0
                        && rect["height"].as_f64().unwrap_or(0.0) > 0.0
                };
                let viewport = &visual["viewport"];
                let width = viewport["width"].as_f64().filter(|value| value.is_finite() && *value > 0.0)
                    .ok_or(format!("detail {id} viewport width invalid"))?;
                let height = viewport["height"].as_f64().filter(|value| value.is_finite() && *value > 0.0)
                    .ok_or(format!("detail {id} viewport height invalid"))?;
                if !viewport["deviceScaleFactor"].as_f64().map(|value| value.is_finite() && value > 0.0).unwrap_or(false) {
                    return Err(format!("detail {id} device scale invalid"));
                }
                if !["scrollX", "scrollY"].iter().all(|key| viewport[*key].as_f64().map(|value| value.is_finite()).unwrap_or(false)) {
                    return Err(format!("detail {id} viewport scroll invalid"));
                }
                let target = &visual["target"];
                match target["state"].as_str() {
                    Some("available") if valid_box(&target["box"]) && target["coordinateSpace"] == "main-viewport" => {},
                    Some("unavailable") if target["reason"] == "target-unavailable" => {},
                    _ => return Err(format!("detail {id} target invalid")),
                }
                let element = &visual["element"];
                match element["state"].as_str() {
                    Some("available") => {
                        let image = element["dataUrl"].as_str().ok_or(format!("detail {id} element data missing"))?;
                        let rect = &element["box"];
                        if target["state"] != "available" || !valid_box(rect)
                            || element["mimeType"] != "image/jpeg"
                            || !image.starts_with("data:image/jpeg;base64,") || image.len() > 700_000
                            || rect["x"].as_f64().unwrap_or(-1.0) < 0.0 || rect["y"].as_f64().unwrap_or(-1.0) < 0.0
                            || rect["x"].as_f64().unwrap_or(0.0) + rect["width"].as_f64().unwrap_or(0.0) > width
                            || rect["y"].as_f64().unwrap_or(0.0) + rect["height"].as_f64().unwrap_or(0.0) > height {
                            return Err(format!("detail {id} element capture invalid"));
                        }
                    },
                    Some("unavailable") if matches!(element["reason"].as_str(),
                        Some("budget" | "capture-error" | "outside-viewport" | "target-unavailable"))
                        && element.get("dataUrl").is_none() => {},
                    _ => return Err(format!("detail {id} element state invalid")),
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
    if checked > 9_007_199_254_740_991 { return Err("detail checkedPages invalid".to_string()); }
    let failed_pages = coverage["failedPages"].as_array().ok_or("detail failedPages missing")?;
    if !coverage["timedOut"].is_boolean()
        || coverage.get("cancelled").is_some_and(|value| !value.is_boolean()) {
        return Err("detail coverage flags invalid".to_string());
    }
    let nonempty_string = |value: &serde_json::Value| value.as_str().is_some_and(|text| !text.is_empty());
    let safe_integer = |value: &serde_json::Value| value.as_u64().is_some_and(|number| number <= 9_007_199_254_740_991);
    for page in failed_pages {
        if !nonempty_string(&page["url"]) || !safe_integer(&page["status"]) || !nonempty_string(&page["reason"]) {
            return Err("detail failed page invalid".to_string());
        }
    }
    if let Some(outcomes) = detail.get("pageOutcomes") {
        let outcomes = outcomes.as_array().ok_or("detail pageOutcomes must be an array")?;
        if outcomes.len() > 200 { return Err("detail pageOutcomes exceeds limit".to_string()); }
        let mut urls = std::collections::HashSet::new();
        let mut checked_count = 0;
        let mut failed_count = 0;
        for page in outcomes {
            if !nonempty_string(&page["url"]) || !nonempty_string(&page["finalUrl"])
                || !safe_integer(&page["status"]) || !safe_integer(&page["depth"])
                || page.get("reason").is_some_and(|reason| !nonempty_string(reason)) {
                return Err("detail page outcome invalid".to_string());
            }
            if !urls.insert(page["url"].as_str().unwrap()) { return Err("detail page outcome URL duplicated".to_string()); }
            let status = page["status"].as_u64().unwrap();
            let issue = page.get("issue");
            if let Some(issue) = issue {
                let kinds = ["challenge", "denied", "rate-limit", "login-required", "timeout", "navigation", "unknown"];
                if !issue["kind"].as_str().is_some_and(|kind| kinds.contains(&kind)) || !issue["retryable"].is_boolean()
                    || issue.get("retryAfterMs").is_some_and(|ms| !ms.as_u64().is_some_and(|ms| ms <= 5000)) {
                    return Err("detail page issue invalid".to_string());
                }
            }
            if page.get("discoverySource").is_some_and(|source| !source.as_str().is_some_and(|source| ["entry", "link", "sitemap"].contains(&source))) {
                return Err("detail discovery source invalid".to_string());
            }
            let was_checked = status > 0 && status < 400 && issue.is_none();
            if page["outcome"] != if was_checked { "checked" } else { "failed" } {
                return Err("detail page outcome status mismatch".to_string());
            }
            if was_checked { checked_count += 1; } else {
                failed_count += 1;
                if !failed_pages.iter().any(|failed| failed["url"] == page["url"] && failed["status"] == page["status"]) {
                    return Err("detail page outcome missing failed coverage".to_string());
                }
            }
        }
        if checked_count != checked || failed_count != failed_pages.len() as u64 {
            return Err("detail page outcomes coverage mismatch".to_string());
        }
    }
    if let Some(analysis) = detail.get("imageAnalysis") {
        let analysis = analysis.as_array().ok_or("detail imageAnalysis must be an array")?;
        if analysis.len() > 64 { return Err("detail imageAnalysis exceeds limit".to_string()); }
        let string_array = |value: &serde_json::Value| value.as_array().is_some_and(|items| items.iter().all(nonempty_string));
        for image in analysis {
            if !nonempty_string(&image["sourceUrl"]) || !string_array(&image["pageUrls"])
                || image["pageUrls"].as_array().is_none_or(Vec::is_empty) || !string_array(&image["matchedTerms"])
                || image.get("normalizedText").is_some_and(|text| !text.is_string()) {
                return Err("detail image analysis identity invalid".to_string());
            }
            let ocr = &image["ocr"];
            if !nonempty_string(&ocr["backend"]) { return Err("detail OCR backend invalid".to_string()); }
            match ocr["state"].as_str() {
                Some("available") if ocr["text"].is_string()
                    && ocr["confidence"].as_f64().is_some_and(|confidence| confidence.is_finite() && (0.0..=1.0).contains(&confidence)) => {},
                Some("unavailable") if matches!(ocr["reason"].as_str(), Some("budget" | "recognition-error")) => {},
                _ => return Err("detail OCR result invalid".to_string()),
            }
            let decision = &image["decision"];
            if !nonempty_string(&decision["rule"]) || !nonempty_string(&decision["detail"])
                || !decision["passed"].is_boolean()
                || !["score", "threshold"].iter().all(|field| decision[*field].as_f64().is_some_and(f64::is_finite)) {
                return Err("detail image analysis decision invalid".to_string());
            }
            if decision["passed"].as_bool() != Some(decision["score"].as_f64().unwrap() >= decision["threshold"].as_f64().unwrap()) {
                return Err("detail image analysis decision threshold mismatch".to_string());
            }
        }
    }
    let extra: serde_json::Value = serde_json::from_str(extra_text).map_err(|e| e.to_string())?;
    let extras = extra["findings"].as_array().ok_or("extra findings missing")?;
    let images = detail["creativeImages"].as_array().ok_or("detail creativeImages missing")?;
    if images.len() > 64 { return Err("detail creativeImages exceeds limit".to_string()); }
    let mut ids = std::collections::HashSet::new();
    let mut image_chars = 0;
    for image in images {
        let id = image["findingId"].as_str().ok_or("creative image findingId missing")?;
        let finding = extras.iter().find(|finding| finding["id"] == id).ok_or("creative image finding missing")?;
        if !ids.insert(id) || finding["extra_finding"] != "REUSED_AD_CREATIVE"
            || finding["url"] != image["sourceUrl"] || finding["location"] != image["sourceUrl"] {
            return Err("creative image identity invalid".to_string());
        }
        let mime = image["mimeType"].as_str().ok_or("creative image MIME missing")?;
        let data = image["dataUrl"].as_str().ok_or("creative image data missing")?;
        let hash = image["sha256"].as_str().ok_or("creative image hash missing")?;
        let encoded = data.split_once(',').map(|(_, payload)| payload).unwrap_or("");
        let content = encoded.trim_end_matches('=');
        if !matches!(mime, "image/png" | "image/jpeg" | "image/webp")
            || !data.starts_with(&format!("data:{mime};base64,")) || data.len() > 334_000
            || content.is_empty() || encoded.len() - content.len() > 2
            || !content.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/')
            || hash.len() != 64 || !hash.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || image["width"].as_u64().unwrap_or(0) < 8 || image["height"].as_u64().unwrap_or(0) < 8
            || image["capturedAt"].as_str().and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok()).is_none() {
            return Err("creative image representation invalid".to_string());
        }
        image_chars += data.len();
    }
    if image_chars > 2_670_000 { return Err("creative images exceed capture budget".to_string()); }
    crate::evidence::validate_extensions(&detail,extras)?;
    Ok(())
}

pub(crate) fn validate_extra_bundle(official_text: &str, extra_text: &str) -> Result<(), String> {
    if extra_text.len() > 1_000_000 { return Err("extra result exceeds size limit".to_string()); }
    if extra_text.starts_with('\u{FEFF}') { return Err("extra result contained a BOM".to_string()); }
    let official: serde_json::Value = serde_json::from_str(official_text).map_err(|e| e.to_string())?;
    let extra: serde_json::Value = serde_json::from_str(extra_text).map_err(|e| format!("extra result invalid JSON: {e}"))?;
    for field in ["topic", "entry_url", "started_at", "finished_at", "elapsed_sec", "tool_version"] {
        if extra["meta"][field] != official["meta"][field] {
            return Err(format!("extra result meta.{field} mismatch"));
        }
    }
    let findings = extra["findings"].as_array().ok_or("extra findings must be an array")?;
    let mut ids = std::collections::HashSet::new();
    for (index, finding) in findings.iter().enumerate() {
        let at = format!("extra findings[{index}]");
        let id = finding["id"].as_str().ok_or(format!("{at}.id missing"))?;
        if !ids.insert(id) { return Err(format!("{at}.id duplicated")); }
        if finding["technique"].as_str() != Some("ETC") { return Err(format!("{at}.technique must be ETC")); }
        if !matches!(finding["extra_finding"].as_str(), Some("IMAGE_ONLY_ILLEGAL_AD" | "REUSED_AD_CREATIVE" | "AD_INFRASTRUCTURE_CORRELATION" | "ZERO_WIDTH_OBFUSCATION")) {
            return Err(format!("{at}.extra_finding invalid"));
        }
        for field in ["url", "location", "evidence_text"] {
            if finding[field].as_str().is_none_or(str::is_empty) { return Err(format!("{at}.{field} missing")); }
        }
        if finding["is_violation"].as_bool() != Some(true) { return Err(format!("{at}.is_violation invalid")); }
    }
    Ok(())
}

#[cfg(test)]
mod validation_tests {
    use super::{validate_detail_bundle, validate_extra_bundle, validate_sidecar_stdout};

    fn good_json() -> String {
        "{\"meta\":{\"topic\":\"t\",\"entry_url\":\"https://example.kr/\",\"started_at\":\"2026-10-01T00:00:00Z\",\"finished_at\":\"2026-10-01T00:01:00Z\",\"elapsed_sec\":60,\"tool_version\":\"0.1.0\"},\"findings\":[{\"id\":\"f1\",\"url\":\"https://example.kr/a\",\"is_violation\":true,\"location\":\"#a\",\"evidence_text\":\"x\",\"technique\":\"HOMOGLYPH\"}]}".to_string()
    }

    #[test]
    fn rejects_unreconciled_page_outcomes_and_invalid_ocr_decisions() {
        let detail = serde_json::json!({
            "version": 2, "creativeImages": [],
            "findings": [{"findingId":"f1", "url":"https://example.kr/a", "location":"#a",
                "technique":"HOMOGLYPH", "rawText":"x", "observed":{"selector":"#source"},
                "visual":{"state":"unavailable","reason":"budget"}}],
            "coverage": {"checkedPages":1,"failedPages":[{"url":"https://example.kr/slow","status":0,"reason":"cancelled"}],
                "timedOut":false,"cancelled":true},
            "pageOutcomes": [
                {"url":"https://example.kr/a","finalUrl":"https://example.kr/a","status":200,"depth":0,"outcome":"checked"},
                {"url":"https://example.kr/slow","finalUrl":"https://example.kr/slow","status":0,"depth":1,"outcome":"failed","reason":"cancelled"}],
            "imageAnalysis": [{"sourceUrl":"https://example.kr/ad.png","pageUrls":["https://example.kr/a"],
                "ocr":{"state":"available","backend":"local","text":"ad","confidence":0.9},"normalizedText":"ad",
                "matchedTerms":["ad"],"decision":{"rule":"semantic","score":1,"threshold":0.5,"passed":true,"detail":"matching text"}}]
        });
        let check = |value: &serde_json::Value| validate_detail_bundle(&good_json(), &value.to_string(), "{\"findings\":[]}");
        assert!(check(&detail).is_ok());
        let mut challenge = detail.clone();
        challenge["pageOutcomes"][0]["issue"] = serde_json::json!({"kind":"challenge","retryable":false});
        assert_eq!(check(&challenge).unwrap_err(), "detail page outcome status mismatch");
        challenge["pageOutcomes"][0]["outcome"] = serde_json::json!("failed");
        challenge["coverage"]["checkedPages"] = serde_json::json!(0);
        challenge["coverage"]["failedPages"].as_array_mut().unwrap().push(serde_json::json!({"url":"https://example.kr/a","status":200,"reason":"challenge"}));
        assert!(check(&challenge).is_ok());
        challenge["pageOutcomes"][0]["issue"]["retryAfterMs"] = serde_json::json!(5001);
        assert_eq!(check(&challenge).unwrap_err(), "detail page issue invalid");
        let mut wrong = detail.clone();
        wrong["coverage"]["checkedPages"] = serde_json::json!(2);
        assert_eq!(check(&wrong).unwrap_err(), "detail page outcomes coverage mismatch");
        wrong = detail.clone();
        wrong["pageOutcomes"][1]["outcome"] = serde_json::json!("checked");
        assert_eq!(check(&wrong).unwrap_err(), "detail page outcome status mismatch");
        wrong = detail.clone();
        wrong["pageOutcomes"][1]["url"] = serde_json::json!("https://example.kr/missing");
        assert_eq!(check(&wrong).unwrap_err(), "detail page outcome missing failed coverage");
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["ocr"]["confidence"] = serde_json::json!(1.1);
        assert_eq!(check(&wrong).unwrap_err(), "detail OCR result invalid");
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["decision"]["passed"] = serde_json::json!("yes");
        assert_eq!(check(&wrong).unwrap_err(), "detail image analysis decision invalid");
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["decision"]["passed"] = serde_json::json!(false);
        assert_eq!(check(&wrong).unwrap_err(), "detail image analysis decision threshold mismatch");
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["decision"]["score"] = serde_json::json!(0.5);
        assert!(check(&wrong).is_ok(), "score at threshold passes");
        wrong["imageAnalysis"][0]["decision"]["score"] = serde_json::json!(0.4);
        wrong["imageAnalysis"][0]["decision"]["passed"] = serde_json::json!(false);
        assert!(check(&wrong).is_ok(), "score below threshold fails");
        wrong = detail.clone();
        wrong["imageAnalysis"] = serde_json::json!(vec![detail["imageAnalysis"][0].clone(); 64]);
        assert!(check(&wrong).is_ok(), "64 image analyses fit the contract");
        wrong["imageAnalysis"].as_array_mut().unwrap().push(detail["imageAnalysis"][0].clone());
        assert_eq!(check(&wrong).unwrap_err(), "detail imageAnalysis exceeds limit");
        wrong = detail.clone();
        wrong["coverage"]["checkedPages"] = serde_json::json!(200);
        wrong["coverage"]["failedPages"] = serde_json::json!([]);
        let outcomes: Vec<_> = (0..200).map(|index| serde_json::json!({
            "url":format!("https://example.kr/{index}"), "finalUrl":format!("https://example.kr/{index}"),
            "status":200,"depth":0,"outcome":"checked"})).collect();
        wrong["pageOutcomes"] = serde_json::json!(outcomes);
        assert!(check(&wrong).is_ok(), "200 page outcomes reconcile coverage");
        wrong["pageOutcomes"].as_array_mut().unwrap().push(serde_json::json!({
            "url":"https://example.kr/200","finalUrl":"https://example.kr/200","status":200,"depth":0,"outcome":"checked"}));
        wrong["coverage"]["checkedPages"] = serde_json::json!(201);
        assert_eq!(check(&wrong).unwrap_err(), "detail pageOutcomes exceeds limit");
        wrong = detail.clone();
        wrong["findings"][0]["observed"]["selector"] = serde_json::json!("");
        assert_eq!(check(&wrong).unwrap_err(), "detail f1 observed selector invalid");
        wrong = detail;
        wrong["imageAnalysis"][0]["ocr"] = serde_json::json!({"state":"unavailable","backend":"local","reason":"budget"});
        assert!(check(&wrong).is_ok());
    }

    fn good_extra() -> String {
        let official: serde_json::Value = serde_json::from_str(&good_json()).unwrap();
        serde_json::json!({
            "meta": official["meta"],
            "findings": [{
                "id": "x1", "url": "https://example.kr/a", "is_violation": true,
                "location": "https://example.kr/a", "evidence_text": "shared infrastructure",
                "technique": "ETC", "extra_finding": "AD_INFRASTRUCTURE_CORRELATION"
            }]
        }).to_string()
    }

    #[test]
    fn accepts_separate_extra_result() {
        assert!(validate_extra_bundle(&good_json(), &good_extra()).is_ok());
    }

    #[test]
    fn rejects_extra_metadata_and_type_mismatch() {
        let mut wrong_time: serde_json::Value = serde_json::from_str(&good_extra()).unwrap();
        wrong_time["meta"]["elapsed_sec"] = serde_json::json!(61);
        assert!(validate_extra_bundle(&good_json(), &wrong_time.to_string()).is_err());
        let mut wrong_type: serde_json::Value = serde_json::from_str(&good_extra()).unwrap();
        wrong_type["findings"][0]["extra_finding"] = serde_json::json!("UNKNOWN");
        assert!(validate_extra_bundle(&good_json(), &wrong_type.to_string()).is_err());
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
            "creativeImages": [],
            "findings": [{"findingId":"f1", "url":"https://example.kr/a", "location":"#a",
                "technique":"HOMOGLYPH", "rawText":"x", "visual":{"state":"unavailable","reason":"budget"}}],
            "coverage": {"checkedPages":1,"failedPages":[],"timedOut":false}
        });
        assert!(validate_detail_bundle(&good_json(), &detail.to_string(), "{\"findings\":[]}").is_ok());
        let mut partial = detail.clone();
        partial["coverage"]["failedPages"] = serde_json::json!([
            {"url":"https://example.kr/missing-a","status":404,"reason":"HTTP 404"},
            {"url":"https://example.kr/missing-b","status":404,"reason":"HTTP 404"}
        ]);
        assert!(validate_detail_bundle(&good_json(), &partial.to_string(), "{\"findings\":[]}").is_ok());
        partial["coverage"]["checkedPages"] = serde_json::json!(-1);
        assert!(validate_detail_bundle(&good_json(), &partial.to_string(), "{\"findings\":[]}").is_err());
        let mut wrong = detail;
        wrong["findings"][0]["location"] = serde_json::Value::String("#other".to_string());
        assert!(validate_detail_bundle(&good_json(), &wrong.to_string(), "{\"findings\":[]}").is_err());
    }
}

#[cfg(test)]
mod tests {
    use super::{new_session, SessionRegistry, SessionStatus};

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
        let record = new_session("https://example.kr/".to_string(), chrono::Utc::now().to_rfc3339());
        let id = record.id.clone();
        registry.insert(record).await;
        let artifact = std::env::temp_dir().join(format!("krds-watchdog-{id}.json"));
        let path = artifact.to_str().unwrap();
        #[cfg(not(windows))]
        let argv = ["sh", "-c", "sleep 2; printf '%s' '{\"completedPages\":1}' > \"$1\"", "watchdog", path];
        #[cfg(windows)]
        let script = format!("Start-Sleep -Seconds 2; [IO.File]::WriteAllText('{}', '{{\"completedPages\":1}}')", path.replace('\'', "''"));
        #[cfg(windows)]
        let argv = ["powershell", "-NoProfile", "-NonInteractive", "-Command", script.as_str()];
        registry.spawn_sidecar_for_test(&id, &argv).await.unwrap();
        let outcome = registry.wait_sidecar_with_watchdog(&id, std::sync::Arc::new(|_| {}), 1).await;
        match outcome {
            super::SessionOutcome::Succeeded { .. } => {},
            super::SessionOutcome::Failed { detail } => panic!("late worker artifact lost: {detail}"),
            super::SessionOutcome::Cancelled => panic!("late worker artifact cancelled"),
        }
        let saved: serde_json::Value = serde_json::from_slice(&std::fs::read(&artifact).unwrap()).unwrap();
        std::fs::remove_file(artifact).unwrap();
        assert_eq!(saved, serde_json::json!({"completedPages": 1}));
    }

    #[tokio::test]
    async fn cancel_unknown_session_returns_false() {
        let registry = SessionRegistry::shared();
        let done = registry.cancel("no-such-session", "2026-10-01T00:00:00Z".to_string()).await;
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
        let done = registry.cancel(&id, "2026-10-01T00:01:00Z".to_string()).await;
        assert!(done);
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        assert_eq!(snapshot["hasResult"], false);
        assert!(registry.validated_export_text(&id).await.is_err());
        assert_eq!(registry.spawn_sidecar(&id, "missing-worker.mjs", &[]).await.unwrap_err(), "session cancelled before worker startup");
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
        registry
            .store_result(&id, "{\"meta\":{},\"findings\":[]}\n".to_string(), "{}".to_string(), "{}".to_string(), "2026-10-01T00:02:00Z".to_string())
            .await;
        assert!(registry.cancel(&id, "2026-10-01T00:03:00Z".to_string()).await);
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "succeeded");
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
        assert!(registry.cancel(&id, "2026-10-01T00:02:00Z".to_string()).await);
        registry
            .store_result(&id, "{\"meta\":{},\"findings\":[]}\n".to_string(), "{}".to_string(), "{}".to_string(), "2026-10-01T00:03:00Z".to_string())
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        assert!(registry.result_value(&id).await.is_none());
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
        let canonical = "{\"meta\":{\"topic\":\"t\",\"entry_url\":\"https://example.kr/\",\"started_at\":\"2026-10-01T00:00:00Z\",\"finished_at\":\"2026-10-01T00:01:00Z\",\"elapsed_sec\":60,\"tool_version\":\"0.1.0\"},\"findings\":[]}\n";
        registry.record_progress(&id, &serde_json::json!({"sequence": 1, "visitedPages": 3, "confirmedFindings": 2})).await;
        registry
            .store_result(&id, canonical.to_string(), "{}".to_string(), "{}".to_string(), "2026-10-01T00:01:00Z".to_string())
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "succeeded");
        let value = registry.result_value(&id).await.expect("result value");
        assert!(value["findings"].as_array().is_some_and(|f| f.is_empty()));
        let text = registry.validated_export_text(&id).await.expect("validated export text");
        assert_eq!(serde_json::from_str::<serde_json::Value>(&text).unwrap(), value);
        let progress = registry.progress_snapshot(&id).await;
        assert_eq!(progress.pages, 3);
        assert_eq!(progress.findings, 0, "validated result count overrides worker progress");
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
            .fail(&id, "sidecar exited 1: boom".to_string(), "2026-10-01T00:01:00Z".to_string())
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
        assert!(registry.cancel(&id, "2026-10-01T00:01:00Z".to_string()).await);
        let outcome = waiter.await.expect("waiter joins");
        assert!(matches!(outcome, super::SessionOutcome::Cancelled));
        assert_eq!(registry.snapshot(&id).await.unwrap()["status"], "finalizing");
        registry.complete_cancellation(&id, None, None, "finish".to_string()).await;
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
        assert!(registry.cancel(&id, "2026-10-01T00:01:00Z".to_string()).await);
        let outcome = waiter.await.expect("waiter joins");
        assert!(matches!(outcome, super::SessionOutcome::Cancelled));
        // A late success arriving after cancel must not flip the session.
        registry.complete_cancellation(&id, None, None, "finish".to_string()).await;
        registry
            .store_result(&id, "{\"meta\":{},\"findings\":[]}\n".to_string(), "{}".to_string(), "{}".to_string(), "2026-10-01T00:02:00Z".to_string())
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
            c.args(["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 120"]);
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
        assert!(!registry.record_progress(&id, &serde_json::json!({"sequence": 7, "visitedPages": 1})).await);
        let session = registry.snapshot(&id).await.unwrap();
        assert_eq!(session["progress"]["currentPages"], progress["currentPages"]);
        assert_eq!(session["progress"]["recentActivity"], progress["recentActivity"]);
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
        assert!(!registry.record_progress(&id, &serde_json::json!({"sequence": 10, "visitedPages": 99})).await);
    }

    /// Stderr fragments for the pump child, rendered per platform.
    enum PumpLines {
        Sh(Vec<String>),
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

    async fn run_pump(lines: PumpLines) -> (Vec<serde_json::Value>, super::SessionOutcome, super::ProgressSnapshot) {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        #[cfg(not(windows))]
        let argv: Vec<String> = match lines {
            PumpLines::Sh(fragments) => vec!["sh".to_string(), "-c".to_string(), fragments.join("; ")],
            PumpLines::PowerShell(_) => panic!("PowerShell lines on unix"),
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
            PumpLines::Sh(_) => panic!("sh lines on Windows"),
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
                format!("echo '{}' >&2", event_json("page-visited", 3, "https://example.kr/a")),
                format!("echo '{}' >&2", event_json("session-finished", 9, "https://example.kr/a")),
                format!("echo '{}' >&2", event_json("session-failed", 9, "https://example.kr/a")),
                format!("echo '{}' >&2", event_json("session-cancelled", 0, "https://example.kr/a")),
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
        assert_eq!(snapshot.pages, 3, "host terminal progress must retain the last real page count");
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
                format!("echo '{}' >&2", event_json("page-visited", 2, "https://example.kr/b")),
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
        assert!(registry.cancel(&id, "2026-10-01T00:01:00Z".to_string()).await);
        let outcome = waiter.await.expect("waiter joins");
        assert!(matches!(outcome, super::SessionOutcome::Cancelled));
        assert_eq!(registry.snapshot(&id).await.unwrap()["status"], "finalizing");
        registry.complete_cancellation(&id, None, None, "finish".to_string()).await;
        let snapshot = registry.snapshot(&id).await.expect("snapshot");
        assert_eq!(snapshot["status"], "cancelled");
    }
}
