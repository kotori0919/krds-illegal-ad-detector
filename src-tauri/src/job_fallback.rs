//! Non-Windows fallback: no Job Objects outside Windows. Process cleanup
//! relies on tokio `kill_on_drop(true)` plus explicit owned-child termination on
//! cancel/exit paths. Compiles on Linux/macOS CI; never used in the
//! Windows submission package.

pub struct JobGuard;

impl JobGuard {
    pub fn attach_current() -> Result<Self, String> {
        Ok(Self)
    }
}
