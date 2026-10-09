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

    type Handle = *mut c_void;
    type Bool = i32;
    type Dword = u32;
    type Lpvoid = *mut c_void;
    type Lpcwstr = *const u16;

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: Dword = 0x2000;
    const JOBOBJECTEXTENDEDLIMITINFORMATION_CLASS: i32 = 9;
    const PROCESS_SET_QUOTA: Dword = 0x0100;
    const PROCESS_TERMINATE: Dword = 0x0001;

    #[repr(C)]
    struct JobObjectBasicLimitInformation {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: Dword,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: Dword,
        affinity: usize,
        priority_class: Dword,
        scheduling_class: Dword,
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
        fn CreateJobObjectW(attrs: Lpvoid, name: Lpcwstr) -> Handle;
        fn SetInformationJobObject(job: Handle, class: i32, info: Lpvoid, len: Dword) -> Bool;
        fn AssignProcessToJobObject(job: Handle, process: Handle) -> Bool;
        fn OpenProcess(desired: Dword, inherit: Bool, pid: Dword) -> Handle;
        fn CloseHandle(handle: Handle) -> Bool;
    }

    pub struct JobGuard {
        handle: Handle,
    }

    // SAFETY: the Handle is an owned kernel object closed exactly once in
    // Drop on the thread that drops the guard. Tauri commands are Send
    // futures, so the guard must be Send+Sync to live in session state.
    unsafe impl Send for JobGuard {}
    unsafe impl Sync for JobGuard {}

    impl JobGuard {
        fn create_kill_on_close() -> Result<Handle, String> {
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
                    &mut info as *mut _ as Lpvoid,
                    size_of::<JobObjectExtendedLimitInformation>() as Dword,
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
                let child = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
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
