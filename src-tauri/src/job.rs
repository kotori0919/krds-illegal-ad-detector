//! Windows Job Object guard: the scanner worker spawns a browser, which
//! spawns renderer processes. Attaching the worker to a Job Object with
//! JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE guarantees the whole tree dies when
//! the guard drops — cancel, crash, timeout, and app-exit paths all funnel
//! through Drop. This is the KODEX §15 mechanism; POSIX builds use
//! kill_on_drop as the equivalent.

#[cfg(windows)]
mod imp {
    use core::ffi::c_void;
    use core::ptr::{null, null_mut};

    type HANDLE = *mut c_void;
    type BOOL = i32;
    type DWORD = u32;
    type LPVOID = *mut c_void;
    type LPCWSTR = *const u16;

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: DWORD = 0x2000;
    const JOBOBJECTEXTENDEDLIMITINFORMATION_CLASS: i32 = 9;

    #[repr(C)]
    struct JobObjectBasicLimitInformation {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: DWORD,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: DWORD,
        affinity: usize,
        priority_class: DWORD,
        scheduling_class: DWORD,
    }

    #[repr(C)]
    struct JobObjectExtendedLimitInformation {
        basic_limit_information: JobObjectBasicLimitInformation,
        io_info: [u8; 48],
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn CreateJobObjectW(attrs: LPVOID, name: LPCWSTR) -> HANDLE;
        fn SetInformationJobObject(
            job: HANDLE,
            class: i32,
            info: LPVOID,
            len: DWORD,
        ) -> BOOL;
        fn AssignProcessToJobObject(job: HANDLE, process: HANDLE) -> BOOL;
        fn CloseHandle(handle: HANDLE) -> BOOL;
        fn GetCurrentProcess() -> HANDLE;
    }

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
                let handle = CreateJobObjectW(null_mut(), null());
                if handle.is_null() {
                    return Err("CreateJobObjectW failed".to_string());
                }
                let mut info = JobObjectExtendedLimitInformation {
                    basic_limit_information: JobObjectBasicLimitInformation {
                        per_process_user_time_limit: 0,
                        per_job_user_time_limit: 0,
                        limit_flags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                        minimum_working_set_size: 0,
                        maximum_working_set_size: 0,
                        active_process_limit: 0,
                        affinity: 0,
                        priority_class: 0,
                        scheduling_class: 0,
                    },
                    io_info: [0; 48],
                    process_memory_limit: 0,
                    job_memory_limit: 0,
                    peak_process_memory_used: 0,
                    peak_job_memory_used: 0,
                };
                let ok = SetInformationJobObject(
                    handle,
                    JOBOBJECTEXTENDEDLIMITINFORMATION_CLASS,
                    &mut info as *mut _ as LPVOID,
                    size_of::<JobObjectExtendedLimitInformation>() as DWORD,
                );
                if ok == 0 {
                    CloseHandle(handle);
                    return Err("SetInformationJobObject failed".to_string());
                }
                let ok = AssignProcessToJobObject(handle, GetCurrentProcess());
                if ok == 0 {
                    CloseHandle(handle);
                    return Err("AssignProcessToJobObject failed".to_string());
                }
                Ok(Self { handle })
            }
        }

        #[must_use]
        pub fn raw(&self) -> isize {
            self.handle as isize
        }
    }

    impl Drop for JobGuard {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }
}

#[cfg(windows)]
pub use imp::JobGuard;
