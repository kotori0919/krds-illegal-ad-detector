//! Windows Job Object guard: the scanner worker spawns a browser, which
//! spawns renderer processes. Attaching the worker to a Job Object with
//! JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE guarantees the whole tree dies when
//! the guard drops — cancel, crash, timeout, and app-exit paths all funnel
//! through Drop. This is the KODEX §15 mechanism; POSIX builds use
//! kill_on_drop as the equivalent.

#[cfg(windows)]
mod imp {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows::Win32::System::Threading::GetCurrentProcess;

    pub struct JobGuard {
        handle: HANDLE,
    }

    // SAFETY: the HANDLE is an owned kernel object closed exactly once in
    // Drop on the thread that drops the guard. Tauri commands are Send
    // futures, so the guard must be Send+Sync to live in session state.
    unsafe impl Send for JobGuard {}
    unsafe impl Sync for JobGuard {}

    impl JobGuard {
        /// Create a kill-on-close job and attach the current process; the
        /// sidecar child inherits membership, covering browser descendants.
        pub fn attach_current() -> Result<Self, String> {
            unsafe {
                let handle = CreateJobObjectW(None, None)
                    .map_err(|e| format!("CreateJobObjectW failed: {e}"))?;
                let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const _,
                    std::mem::size_of_val(&info) as u32,
                )
                .map_err(|e| format!("SetInformationJobObject failed: {e}"))?;
                AssignProcessToJobObject(handle, GetCurrentProcess())
                    .map_err(|e| format!("AssignProcessToJobObject failed: {e}"))?;
                Ok(Self { handle })
            }
        }

        #[must_use]
        pub fn raw(&self) -> isize {
            self.handle.0 as isize
        }
    }

    impl Drop for JobGuard {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.handle);
            }
        }
    }
}

#[cfg(windows)]
pub use imp::JobGuard;
