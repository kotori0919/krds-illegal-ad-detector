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

#[cfg(windows)]
use crate::job::JobGuard;
#[cfg(not(windows))]
use crate::job_fallback::JobGuard;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionStatus {
    Crawling,
    Analyzing,
    Finalizing,
    Succeeded,
    Cancelled,
    Failed,
}

impl SessionStatus {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Crawling => "crawling",
            Self::Analyzing => "analyzing",
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
    pub topic: String,
    pub status: SessionStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error: Option<String>,
    pub child: Option<tokio::process::Child>,
    pub child_pid: Option<u32>,
    pub job: Option<SendJobGuard>,
    pub result_json: Option<String>,
    pub extra_json: Option<String>,
}

impl SessionRecord {
    fn new(id: String, entry_url: String, topic: String, started_at: String) -> Self {
        Self {
            id,
            entry_url,
            topic,
            status: SessionStatus::Crawling,
            started_at,
            finished_at: None,
            error: None,
            child: None,
            child_pid: None,
            job: None,
            result_json: None,
            extra_json: None,
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

#[derive(Default, Clone, Copy)]
pub struct ProgressSnapshot {
    pub pages: u64,
    pub findings: u64,
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

    /// Cancel keeps an effective kill path in every state: live Child is
    /// killed directly, and the Job guard drops (whole-tree kill) even when
    /// the waiter already reaped the Child. Terminal states are left alone.
    pub async fn cancel(&self, session_id: &str, finished_at: String) -> bool {
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
        // Cancel wins the race against a concurrently exiting child: the
        // Child is taken out of the record HERE (under the lock) so the
        // waiter's natural-exit path observes "no child" and can never
        // complete the session as succeeded (OBSERVED on VM: the cancel
        // keystroke landed but the scan still showed succeeded 17/17).
        // kill_child takes the already-removed Child (no-op) and drops
        // the Job guard for whole-tree kill.
        let mut taken = record.child.take();
        record.job.take();
        // Drop the guard before awaiting kill (Child is owned locally now).
        drop(guard);
        if let Some(mut child) = taken.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
        record.child_pid = None;
        record.status = SessionStatus::Cancelled;
        record.finished_at = Some(finished_at);
        true
    }

    pub async fn store_result(&self, session_id: &str, canonical: String, finished_at: String) {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return;
        };
        // Never overwrite a terminal cancel/fail with a late success.
        if matches!(record.status, SessionStatus::Cancelled | SessionStatus::Failed) {
            return;
        }
        record.result_json = Some(canonical);
        record.status = SessionStatus::Succeeded;
        record.finished_at = Some(finished_at);
        record.error = None;
    }

    pub async fn fail(&self, session_id: &str, detail: String, finished_at: String) {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return;
        };
        if matches!(record.status, SessionStatus::Cancelled) {
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
            "topic": record.topic,
            "status": record.status.as_str(),
            "startedAt": record.started_at,
            "finishedAt": record.finished_at,
            "error": record.error,
        }))
    }

    pub async fn result_value(&self, session_id: &str) -> Option<serde_json::Value> {
        let guard = self.inner.lock().await;
        let text = guard.get(session_id)?.result_json.clone()?;
        serde_json::from_str(&text).ok()
    }

    pub async fn result_text(&self, session_id: &str) -> Option<String> {
        let guard = self.inner.lock().await;
        guard.get(session_id)?.result_json.clone()
    }

    pub async fn progress_snapshot(&self, session_id: &str) -> ProgressSnapshot {
        let guard = self.inner.lock().await;
        let Some(record) = guard.get(session_id) else {
            return ProgressSnapshot::default();
        };
        let findings = record
            .result_json
            .as_deref()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
            .and_then(|value| value.get("findings")?.as_array().cloned())
            .map(|items| items.len() as u64)
            .unwrap_or(0);
        ProgressSnapshot { pages: 0, findings }
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
        &self,
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
        let diagnostics = std::sync::Arc::new(tokio::sync::Mutex::new(VecDeque::<String>::new()));
        let pump_diagnostics = diagnostics.clone();
        let pump = tokio::spawn(async move {
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
                    let progress = value.get("progress").cloned().unwrap_or(serde_json::json!({
                        "visitedPages": 0, "queuedPages": 0, "framesInspected": 0,
                        "elementsAnalyzed": 0, "candidates": 0, "confirmedFindings": 0,
                        "elapsedSec": 0, "stage": "crawling",
                    }));
                    on_progress(serde_json::json!({
                        "kind": kind,
                        "sessionId": session_owned,
                        "at": chrono::Utc::now().to_rfc3339(),
                        "progress": progress,
                        "message": value.get("message"),
                        "pageUrl": value.get("pageUrl"),
                    }));
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
        let _ = tokio::time::timeout(std::time::Duration::from_secs(5), pump).await;
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
            enum Poll { Cancelled, Failed(String), Running, Exited }
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
                Poll::Cancelled => return SessionOutcome::Cancelled,
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
                    if record.status == SessionStatus::Cancelled {
                        record.child.take();
                        record.job.take();
                        drop(guard);
                        return SessionOutcome::Cancelled;
                    }
                    let Some(child) = record.child.take() else {
                        return SessionOutcome::Cancelled;
                    };
                    record.job.take();
                    drop(guard);
                    return Self::collect_output(child, session_id).await;
                }
            }
        }
    }

    /// Collect piped output from an exited child (called after try_wait
    /// observed exit, or for a freshly spawned child in tests).
    async fn collect_output(
        mut child: tokio::process::Child,
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
                        let _ = std::fs::remove_file(&candidate);
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
            if !guard.contains_key(session_id) {
                return Err("unknown session".to_string());
            }
        }
        let is_script = sidecar_path.ends_with(".mjs") || sidecar_path.ends_with(".js");
        // Portable runtime resolution (install layout, docs/INSTALL_LAYOUT):
        // exe-adjacent node.exe first, PATH node second. The worker bundle
        // is JavaScript, not itself executable: fixed invocation, still no
        // caller shell string.
        let node_bin = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|d| d.join("node.exe")))
            .filter(|p| p.is_file())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "node".to_string());
        let mut cmd = std::process::Command::new(if is_script { &node_bin } else { sidecar_path });
        if is_script {
            cmd.arg(sidecar_path);
        }
        // Portable browser resolution: prefer the HOST executable's
        // directory (installed layout: exe + node.exe + ms-playwright/),
        // NOT the worker's node.exe parent — node may be a system install
        // elsewhere. Env override wins when it points at a real dir.
        // Never hard-code a user profile path.
        #[cfg(windows)]
        {
            let host_dir = std::env::current_exe().ok().and_then(|exe| {
                exe.parent().map(|d| d.to_path_buf())
            });
            let shell_dir = std::env::var_os("PLAYWRIGHT_BROWSERS_PATH")
                .map(std::path::PathBuf::from)
                .filter(|p| p.is_dir())
                .or_else(|| {
                    host_dir.clone().map(|d| d.join("ms-playwright")).filter(|p| p.is_dir())
                })
                .or_else(|| {
                    host_dir.map(|d| d.join("node.exe")).filter(|p| p.is_file())
                        .and_then(|n| n.parent().map(|d| d.to_path_buf()))
                });
            if let Some(dir) = shell_dir {
                cmd.env("PLAYWRIGHT_BROWSERS_PATH", dir);
            }
        }
        cmd.args(args)
            .stdin(SyncStdio::null())
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
            .stdin(SyncStdio::null())
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

pub fn new_session(entry_url: String, topic: String, started_at: String) -> SessionRecord {
    let id = uuid::Uuid::new_v4().to_string();
    SessionRecord::new(id, entry_url, topic, started_at)
}

#[cfg(test)]
mod tests {
    use super::{new_session, SessionRegistry, SessionStatus};

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
            "test".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let done = registry.cancel(&id, "2026-10-01T00:01:00Z".to_string()).await;
        assert!(done);
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
    }

    #[tokio::test]
    async fn cancel_after_success_does_not_reopen_session() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "test".to_string(),
            "2026-10-01T00:01:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        registry
            .store_result(&id, "{\"meta\":{},\"findings\":[]}\n".to_string(), "2026-10-01T00:02:00Z".to_string())
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
            "test".to_string(),
            "2026-10-01T00:01:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        assert!(registry.cancel(&id, "2026-10-01T00:02:00Z".to_string()).await);
        registry
            .store_result(&id, "{\"meta\":{},\"findings\":[]}\n".to_string(), "2026-10-01T00:03:00Z".to_string())
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
            "test".to_string(),
            "2026-10-01T00:00:00Z".to_string(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let canonical = "{\"meta\":{\"topic\":\"t\",\"entry_url\":\"https://example.kr/\",\"started_at\":\"2026-10-01T00:00:00Z\",\"finished_at\":\"2026-10-01T00:01:00Z\",\"elapsed_sec\":60,\"tool_version\":\"0.1.0\"},\"findings\":[]}\n";
        registry
            .store_result(&id, canonical.to_string(), "2026-10-01T00:01:00Z".to_string())
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "succeeded");
        let value = registry.result_value(&id).await.expect("result value");
        assert!(value["findings"].as_array().is_some_and(|f| f.is_empty()));
        let text = registry.result_text(&id).await.expect("result text");
        assert_eq!(text, canonical);
    }

    #[tokio::test]
    async fn fail_marks_session_failed_with_detail() {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "test".to_string(),
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
            "test".to_string(),
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
            "test".to_string(),
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
        registry
            .store_result(&id, "{\"meta\":{},\"findings\":[]}\n".to_string(), "2026-10-01T00:02:00Z".to_string())
            .await;
        let snapshot = registry.snapshot(&id).await.expect("session snapshot");
        assert_eq!(snapshot["status"], "cancelled");
        assert!(registry.result_value(&id).await.is_none());
    }

    #[test]
    fn status_strings_match_contract() {
        assert_eq!(SessionStatus::Crawling.as_str(), "crawling");
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
            "KRDSPROGRESS {{\"kind\":\"{kind}\",\"message\":null,\"pageUrl\":\"{url}\",\"progress\":{{\"visitedPages\":{pages},\"queuedPages\":0,\"framesInspected\":0,\"elementsAnalyzed\":0,\"candidates\":0,\"confirmedFindings\":0,\"elapsedSec\":0,\"stage\":\"crawling\"}}}}"
        )
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

    async fn run_pump(lines: PumpLines) -> (Vec<serde_json::Value>, super::SessionOutcome) {
        let registry = SessionRegistry::shared();
        let record = new_session(
            "https://example.kr/".to_string(),
            "test".to_string(),
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
        (events, outcome)
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
        let (events, _) = run_pump(PumpLines::for_target(
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
    }

    #[tokio::test]
    async fn malformed_and_plain_lines_do_not_break_forwarding() {
        let (events, _) = run_pump(PumpLines::for_target(
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
        let (_, outcome) = run_pump(PumpLines::for_target(
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
        let (events, _) = run_pump(PumpLines::for_target(
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
            "test".to_string(),
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
        let snapshot = registry.snapshot(&id).await.expect("snapshot");
        assert_eq!(snapshot["status"], "cancelled");
    }
}
