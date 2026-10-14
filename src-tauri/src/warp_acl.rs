//! Native protected DACL: current token user and LocalSystem only.
use super::WarpFailureCode;
use std::{ffi::c_void, os::windows::ffi::OsStrExt, path::Path, ptr::null_mut};
type Ptr = *mut c_void;
#[link(name = "advapi32")]
unsafe extern "system" {
    fn OpenProcessToken(process: Ptr, access: u32, token: *mut Ptr) -> i32;
    fn GetTokenInformation(token: Ptr, class: u32, info: Ptr, size: u32, returned: *mut u32)
        -> i32;
    fn ConvertSidToStringSidW(sid: Ptr, string: *mut *mut u16) -> i32;
    fn ConvertStringSidToSidW(string: *const u16, sid: *mut Ptr) -> i32;
    fn ConvertStringSecurityDescriptorToSecurityDescriptorW(
        string: *const u16,
        revision: u32,
        descriptor: *mut Ptr,
        size: *mut u32,
    ) -> i32;
    fn SetFileSecurityW(path: *const u16, information: u32, descriptor: Ptr) -> i32;
    fn GetNamedSecurityInfoW(
        path: *const u16,
        kind: u32,
        information: u32,
        owner: *mut Ptr,
        group: *mut Ptr,
        dacl: *mut Ptr,
        sacl: *mut Ptr,
        descriptor: *mut Ptr,
    ) -> u32;
    fn GetSecurityDescriptorControl(descriptor: Ptr, control: *mut u16, revision: *mut u32) -> i32;
    fn GetAce(acl: Ptr, index: u32, ace: *mut Ptr) -> i32;
    fn EqualSid(first: Ptr, second: Ptr) -> i32;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetCurrentProcess() -> Ptr;
    fn CloseHandle(handle: Ptr) -> i32;
    fn LocalFree(memory: Ptr) -> Ptr;
    fn CreateDirectoryW(path: *const u16, attributes: *const SecurityAttributes) -> i32;
}
#[repr(C)]
struct SecurityAttributes {
    size: u32,
    descriptor: Ptr,
    inherit: i32,
}
struct Local(Ptr);
impl Drop for Local {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0);
        }
    }
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
fn path_wide(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}
fn denied<T>() -> Result<T, WarpFailureCode> {
    Err(WarpFailureCode::ConfigPermission)
}

fn user_sid() -> Result<Local, WarpFailureCode> {
    unsafe {
        let mut token = null_mut();
        if OpenProcessToken(GetCurrentProcess(), 8, &mut token) == 0 {
            return denied();
        }
        let mut size = 0;
        GetTokenInformation(token, 1, null_mut(), 0, &mut size);
        let mut data = vec![0u64; (size as usize + 7) / 8];
        let ok = GetTokenInformation(token, 1, data.as_mut_ptr().cast(), size, &mut size);
        CloseHandle(token);
        if ok == 0 {
            return denied();
        }
        let sid = *(data.as_ptr() as *const Ptr);
        let mut text = null_mut();
        if ConvertSidToStringSidW(sid, &mut text) == 0 {
            return denied();
        }
        Ok(Local(text.cast()))
    }
}
fn descriptor(directory: bool) -> Result<Local, WarpFailureCode> {
    let user = user_sid()?;
    unsafe {
        let text = user.0 as *const u16;
        let mut len = 0;
        while *text.add(len) != 0 {
            len += 1;
        }
        let sid = String::from_utf16(std::slice::from_raw_parts(text, len))
            .map_err(|_| WarpFailureCode::ConfigPermission)?;
        let flags = if directory { "OICI" } else { "" };
        let sddl = wide(&if sid == "S-1-5-18" {
            format!("D:P(A;{flags};FA;;;SY)")
        } else {
            format!("D:P(A;{flags};FA;;;{sid})(A;{flags};FA;;;SY)")
        });
        let mut ptr = null_mut();
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            1,
            &mut ptr,
            null_mut(),
        ) == 0
        {
            return denied();
        }
        Ok(Local(ptr))
    }
}
fn plain_path(path: &Path) -> Result<std::fs::Metadata, WarpFailureCode> {
    use std::os::windows::fs::MetadataExt;
    let metadata =
        std::fs::symlink_metadata(path).map_err(|_| WarpFailureCode::ConfigPermission)?;
    if metadata.file_attributes() & 0x400 != 0 {
        return denied();
    }
    Ok(metadata)
}
pub fn create_directory(path: &Path) -> Result<(), WarpFailureCode> {
    let descriptor = descriptor(true)?;
    let attrs = SecurityAttributes {
        size: std::mem::size_of::<SecurityAttributes>() as u32,
        descriptor: descriptor.0,
        inherit: 0,
    };
    if unsafe { CreateDirectoryW(path_wide(path).as_ptr(), &attrs) } == 0 {
        return denied();
    }
    verify(path)
}
pub fn protect(path: &Path) -> Result<(), WarpFailureCode> {
    let metadata = plain_path(path)?;
    let descriptor = descriptor(metadata.is_dir())?;
    if unsafe { SetFileSecurityW(path_wide(path).as_ptr(), 0x80000004, descriptor.0) } == 0 {
        return denied();
    }
    verify(path)
}
pub fn verify(path: &Path) -> Result<(), WarpFailureCode> {
    let metadata = plain_path(path)?;
    unsafe {
        let mut dacl = null_mut();
        let mut descriptor = null_mut();
        if GetNamedSecurityInfoW(
            path_wide(path).as_ptr(),
            1,
            4,
            null_mut(),
            null_mut(),
            &mut dacl,
            null_mut(),
            &mut descriptor,
        ) != 0
        {
            return denied();
        }
        let _descriptor = Local(descriptor);
        let mut control = 0;
        let mut revision = 0;
        if dacl.is_null()
            || GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) == 0
            || control & 0x1000 == 0
        {
            return denied();
        }
        let user_text = user_sid()?;
        let mut user = null_mut();
        let mut system = null_mut();
        if ConvertStringSidToSidW(user_text.0.cast(), &mut user) == 0 {
            return denied();
        }
        let _user = Local(user);
        if ConvertStringSidToSidW(wide("S-1-5-18").as_ptr(), &mut system) == 0 {
            return denied();
        }
        let _system = Local(system);
        let same_principal = EqualSid(user, system) != 0;
        let count = if same_principal { 1 } else { 2 };
        // ACL header contains AceCount at byte offset 4.
        if *(dacl.cast::<u8>().add(4).cast::<u16>()) != count {
            return denied();
        }
        let mut found_user = false;
        let mut found_system = same_principal;
        for index in 0..u32::from(count) {
            let mut ace = null_mut();
            if GetAce(dacl, index, &mut ace) == 0 {
                return denied();
            }
            let bytes = ace.cast::<u8>();
            if *bytes != 0
                || *bytes.add(1) != if metadata.is_dir() { 3 } else { 0 }
                || *bytes.add(4).cast::<u32>() != 0x001f01ff
            {
                return denied();
            }
            let sid = bytes.add(8).cast();
            if EqualSid(sid, user) != 0 {
                found_user = true;
            } else if EqualSid(sid, system) != 0 {
                found_system = true;
            } else {
                return denied();
            }
        }
        if !found_user || !found_system {
            return denied();
        }
    }
    Ok(())
}
