//! Session registry: owns scanner-sidecar child processes and session state.
//!
//! Design (KODEX §13–15): the Tauri host owns every scanner process it
//! starts — start, cancellation, timeout, crash detection, exit cleanup,
//! descendant cleanup, subsequent-scan recovery. Detection semantics live in
//! the sidecar (Node scanner worker); this module only supervises lifecycle
//! and persists validated result files.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::Command;
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
            job: None,
            result_json: None,
            extra_json: None,
        }
    }

    /// Kill the owned child process tree; safe to call repeatedly.
    pub async fn kill_child(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
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

    pub async fn cancel(&self, session_id: &str, finished_at: String) -> bool {
        let mut guard = self.inner.lock().await;
        let Some(record) = guard.get_mut(session_id) else {
            return false;
        };
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

    /// Wait for the owned sidecar child to exit and collect its output.
    /// Takes the child out of the record so cancel/kill owns termination;
    /// a missing child means cancel already reaped it.
    pub async fn wait_sidecar(&self, session_id: &str) -> SessionOutcome {
        let child = {
            let mut guard = self.inner.lock().await;
            let Some(record) = guard.get_mut(session_id) else {
                return SessionOutcome::Failed {
                    detail: "unknown session".to_string(),
                };
            };
            record.child.take()
        };
        let Some(child) = child else {
            return SessionOutcome::Cancelled;
        };
        match child.wait_with_output().await {
            Ok(output) => {
                let mut guard = self.inner.lock().await;
                let cancelled = guard
                    .get(session_id)
                    .is_some_and(|r| r.status == SessionStatus::Cancelled);
                if cancelled {
                    return SessionOutcome::Cancelled;
                }
                drop(guard);
                if output.status.success() {
                    SessionOutcome::Succeeded {
                        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    SessionOutcome::Failed {
                        detail: format!(
                            "sidecar exited {}: {}",
                            output.status,
                            stderr.trim()
                        ),
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
    pub async fn spawn_sidecar(
        self: &Arc<Self>,
        session_id: &str,
        sidecar_path: &str,
        args: &[&str],
    ) -> Result<u32, String> {
        let mut guard = self.inner.lock().await;
        let record = guard
            .get_mut(session_id)
            .ok_or_else(|| "unknown session".to_string())?;
        let mut cmd = Command::new(sidecar_path);
        cmd.args(args)
            .kill_on_drop(true)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        {
            #[allow(unused_imports)]
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: no console flash for the worker.
            cmd.creation_flags(0x0800_0000);
        }
        #[cfg(windows)]
        {
            // Attach the sidecar to a kill-on-close Job before spawn so the
            // whole tree (worker -> browser -> renderers) dies with the guard
            // on cancel, crash, timeout, or app exit — even on kill escalation.
            let job = JobGuard::attach_current()?;
            record.job = Some(SendJobGuard(job));
        }
        let child = cmd.spawn().map_err(|e| format!("sidecar spawn failed: {e}"))?;
        let pid = child.id().unwrap_or(0);
        record.child = Some(child);
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

    #[test]
    fn status_strings_match_contract() {
        assert_eq!(SessionStatus::Crawling.as_str(), "crawling");
        assert_eq!(SessionStatus::Cancelled.as_str(), "cancelled");
        assert_eq!(SessionStatus::Failed.as_str(), "failed");
    }
}
