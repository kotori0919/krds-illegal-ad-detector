//! Windows Job Object guard: the scanner worker spawns a browser, which
//! spawns renderer processes. Attaching the worker CHILD to a Job Object
//! with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE guarantees the whole tree dies
//! when the session guard drops — cancel, crash, timeout, and app-exit paths
//! all funnel through Drop. This is the KODEX §15 mechanism; POSIX builds use
//! kill_on_drop as the equivalent.
//!
//! The guard NEVER targets the Tauri host process: `assign_pid` opens only
//! the sidecar child by pid. Attaching the host would kill the application
//! itself on session cleanup — the exact failure this design prevents.

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
    const PROCESS_SET_QUOTA: DWORD = 0x0100;
    const PROCESS_TERMINATE: DWORD = 0x0001;

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

    #[link(name = "kernel32", kind = "raw-dylib")]
    unsafe extern "system" {
        fn CreateJobObjectW(attrs: LPVOID, name: LPCWSTR) -> HANDLE;
        fn SetInformationJobObject(
            job: HANDLE,
            class: i32,
            info: LPVOID,
            len: DWORD,
        ) -> BOOL;
        fn AssignProcessToJobObject(job: HANDLE, process: HANDLE) -> BOOL;
        fn OpenProcess(desired: DWORD, inherit: BOOL, pid: DWORD) -> HANDLE;
        fn CloseHandle(handle: HANDLE) -> BOOL;
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
        fn create_kill_on_close() -> Result<HANDLE, String> {
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
                Ok(handle)
            }
        }

        /// Assign the CHILD sidecar pid (never the host) to a new
        /// kill-on-close Job. The worker→browser→renderer tree dies with
        /// the session guard on cancel/crash/timeout/app-exit.
        pub fn assign_pid(pid: u32) -> Result<Self, String> {
            unsafe {
                let handle = Self::create_kill_on_close()?;
                let child =
                    OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
                if child.is_null() {
                    CloseHandle(handle);
                    return Err(format!("OpenProcess({pid}) failed"));
                }
                let ok = AssignProcessToJobObject(handle, child);
                // The Job holds its own reference; close our temp handle.
                CloseHandle(child);
                if ok == 0 {
                    CloseHandle(handle);
                    return Err(format!("AssignProcessToJobObject({pid}) failed"));
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
