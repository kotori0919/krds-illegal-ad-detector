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
mod job;
#[cfg(windows)]
pub use job::JobGuard;
#[cfg(not(windows))]
mod job_fallback;
#[cfg(not(windows))]
pub use job_fallback::JobGuard;

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

pub struct SessionRecord {
    pub id: String,
    pub entry_url: String,
    pub topic: String,
    pub status: SessionStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error: Option<String>,
    pub child: Option<tokio::process::Child>,
    pub job: Option<JobGuard>,
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

#[derive(Default)]
pub struct SessionRegistry {
    inner: Mutex<HashMap<String, SessionRecord>>,
}

impl SessionRegistry {
    #[must_use]
    pub fn shared() -> Arc<Self> {
        Arc::new(Self::default())
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

    /// Spawn the scanner sidecar for a session and register the child.
    /// The sidecar command is fixed (node + bundled worker); the frontend
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
        #[allow(unused_mut)]
        let mut cmd = Command::new(sidecar_path);
        cmd.args(args)
            .kill_on_drop(true)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: no console flash for the worker.
            cmd.creation_flags(0x0800_0000);
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
