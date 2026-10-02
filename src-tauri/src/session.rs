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
        record.kill_child().await;
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
        let mut cmd = std::process::Command::new(sidecar_path);
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
