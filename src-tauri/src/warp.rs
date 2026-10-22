//! Managed plaintext usque configuration. No credential values cross IPC.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::Write,
    path::{Path, PathBuf},
};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WarpFailureCode {
    ConfigPermission,
    ConfigInvalid,
    BinaryMissing,
    BinaryIntegrity,
    RegistrationFailed,
    PreparationFailed,
    TunnelExited,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum WarpStatus {
    #[cfg(not(windows))]
    Unsupported,
    Unregistered,
    Registering,
    Ready {
        backend: &'static str,
        version: &'static str,
    },
    Unavailable {
        reason: WarpFailureCode,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum TransportProvenance {
    Direct { reason: DirectReason },
    Warp { backend: Backend, version: Version },
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DirectReason {
    #[serde(rename = "operator")]
    Operator,
    #[serde(rename = "owned-origin")]
    OwnedOrigin,
    #[serde(rename = "source-cli")]
    SourceCli,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScanConnection {
    #[default]
    Direct,
    Warp,
}

impl ScanConnection {
    pub fn worker_args(
        self,
        paths: impl FnOnce() -> Result<Option<(PathBuf, PathBuf)>, String>,
    ) -> Result<Vec<String>, String> {
        if self == Self::Direct {
            return Ok(vec!["--direct-reason".into(), "operator".into()]);
        }
        let mut args = vec!["--require-warp".into()];
        if let Some((executable, configuration)) = paths()? {
            args.extend([
                "--warp-executable".into(), executable.to_string_lossy().into_owned(),
                "--warp-config-file".into(), configuration.to_string_lossy().into_owned(),
            ]);
        }
        Ok(args)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Backend {
    #[serde(rename = "usque")]
    Usque,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Version {
    #[serde(rename = "4.2.1")]
    V421,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransportFailure {
    pub code: WarpFailureCode,
    pub scope: FailureScope,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailureScope {
    #[serde(rename = "incomplete")]
    Incomplete,
}

pub fn valid_settings(value: &serde_json::Value, status: &str) -> bool {
    value.is_object()
        && value.get("connection").is_none_or(|v| serde_json::from_value::<ScanConnection>(v.clone()).is_ok())
        && (value.get("transportFailure").is_none() || status == "failed")
        && value
            .get("transport")
            .is_none_or(|v| serde_json::from_value::<TransportProvenance>(v.clone()).is_ok())
        && value
            .get("transportFailure")
            .is_none_or(|v| serde_json::from_value::<TransportFailure>(v.clone()).is_ok())
}

#[derive(Default)]
pub struct Registration {
    lock: Mutex<()>,
}
struct Paths {
    directory: PathBuf,
    executable: PathBuf,
}
impl Paths {
    fn config(&self) -> PathBuf {
        self.directory.join("config.json")
    }
    fn attempt(&self) -> PathBuf {
        self.directory.join("registration-attempt")
    }
}
const EXE_SHA256: &str = "122f2e40208e81bb814fcb4be4fbbbdc9246860f1f3784f72ae4512b97667e91";
fn unavailable(reason: WarpFailureCode) -> WarpStatus {
    WarpStatus::Unavailable { reason }
}
fn ready() -> WarpStatus {
    WarpStatus::Ready {
        backend: "usque",
        version: "4.2.1",
    }
}

#[cfg(windows)]
#[path = "warp_acl.rs"]
mod acl;

#[cfg(not(windows))]
mod acl {
    use super::*;
    pub fn verify(path: &Path) -> Result<(), WarpFailureCode> {
        use std::os::unix::fs::PermissionsExt;
        let metadata =
            std::fs::symlink_metadata(path).map_err(|_| WarpFailureCode::ConfigPermission)?;
        if metadata.file_type().is_symlink() || metadata.permissions().mode() & 0o077 != 0 {
            return Err(WarpFailureCode::ConfigPermission);
        }
        Ok(())
    }
    pub fn protect(path: &Path) -> Result<(), WarpFailureCode> {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            path,
            std::fs::Permissions::from_mode(if path.is_dir() { 0o700 } else { 0o600 }),
        )
        .map_err(|_| WarpFailureCode::ConfigPermission)?;
        verify(path)
    }
    pub fn create_directory(path: &Path) -> Result<(), WarpFailureCode> {
        use std::os::unix::fs::DirBuilderExt;
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(path)
            .map_err(|_| WarpFailureCode::ConfigPermission)?;
        verify(path)
    }
}

fn verify_binary(path: &Path, expected: &str) -> Result<(), WarpFailureCode> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|_| WarpFailureCode::BinaryMissing)?;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| WarpFailureCode::BinaryIntegrity)?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != expected {
        return Err(WarpFailureCode::BinaryIntegrity);
    }
    Ok(())
}

fn validate_config(path: &Path) -> Result<(), WarpFailureCode> {
    use base64::Engine;
    use std::io::Read;
    let file = std::fs::File::open(path).map_err(|_| WarpFailureCode::ConfigInvalid)?;
    let mut bytes = Vec::new();
    file.take(16385)
        .read_to_end(&mut bytes)
        .map_err(|_| WarpFailureCode::ConfigInvalid)?;
    if bytes.len() > 16384 {
        return Err(WarpFailureCode::ConfigInvalid);
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| WarpFailureCode::ConfigInvalid)?;
    let fields = [
        "private_key",
        "endpoint_v4",
        "endpoint_v6",
        "endpoint_h2_v4",
        "endpoint_h2_v6",
        "endpoint_pub_key",
        "id",
        "access_token",
        "ipv4",
        "ipv6",
    ];
    for field in fields {
        if !value[field]
            .as_str()
            .is_some_and(|s| !s.is_empty() && s.len() <= 4096 && !s.contains('\0'))
        {
            return Err(WarpFailureCode::ConfigInvalid);
        }
    }
    for field in ["endpoint_v4", "endpoint_h2_v4", "ipv4"] {
        if value[field]
            .as_str()
            .unwrap()
            .parse::<std::net::Ipv4Addr>()
            .is_err()
        {
            return Err(WarpFailureCode::ConfigInvalid);
        }
    }
    for field in ["endpoint_v6", "endpoint_h2_v6", "ipv6"] {
        if value[field]
            .as_str()
            .unwrap()
            .parse::<std::net::Ipv6Addr>()
            .is_err()
        {
            return Err(WarpFailureCode::ConfigInvalid);
        }
    }
    let key = base64::engine::general_purpose::STANDARD
        .decode(value["private_key"].as_str().unwrap())
        .map_err(|_| WarpFailureCode::ConfigInvalid)?;
    // usque 4.2.1 generates P-256 SEC1 keys with an uncompressed public point.
    // Validate the bounded encoding, not cryptographic key/point correspondence.
    if key.len() != 121
        || !key.starts_with(b"\x30\x77\x02\x01\x01\x04\x20")
        || key[7..39].iter().all(|byte| *byte == 0)
        || &key[39..57]
            != b"\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\xa1\x44\x03\x42\x00\x04"
    {
        return Err(WarpFailureCode::ConfigInvalid);
    }
    let pem = value["endpoint_pub_key"].as_str().unwrap().trim();
    let body = pem
        .strip_prefix("-----BEGIN PUBLIC KEY-----")
        .and_then(|text| text.strip_suffix("-----END PUBLIC KEY-----"))
        .ok_or(WarpFailureCode::ConfigInvalid)?;
    let body: String = body.chars().filter(|c| !c.is_ascii_whitespace()).collect();
    let public = base64::engine::general_purpose::STANDARD
        .decode(body)
        .map_err(|_| WarpFailureCode::ConfigInvalid)?;
    // SPKI ecPublicKey + prime256v1 OIDs, BIT STRING with one uncompressed point.
    if public.len() != 91 || !public.starts_with(b"\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00\x04") {
        return Err(WarpFailureCode::ConfigInvalid);
    }
    Ok(())
}

impl Registration {
    fn stored_status(&self, paths: &Paths, expected: &str) -> WarpStatus {
        if paths.directory.exists() {
            if let Err(code) = acl::verify(&paths.directory) {
                return unavailable(code);
            }
            if paths.attempt().exists() {
                return unavailable(WarpFailureCode::RegistrationFailed);
            }
        }
        if std::fs::symlink_metadata(paths.config())
            .is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound)
        {
            return WarpStatus::Unregistered;
        }
        let checked = acl::verify(&paths.config())
            .and_then(|_| validate_config(&paths.config()))
            .and_then(|_| verify_binary(&paths.executable, expected));
        if let Err(code) = checked {
            return unavailable(code);
        }
        ready()
    }
    fn status_at(&self, paths: &Paths, expected: &str) -> WarpStatus {
        let Ok(_lock) = self.lock.try_lock() else {
            return WarpStatus::Registering;
        };
        self.stored_status(paths, expected)
    }
    async fn register_at(
        &self,
        paths: &Paths,
        consent: bool,
        expected: &str,
        fixture: Option<&Path>,
    ) -> WarpStatus {
        // Consent is checked before touching storage or creating any child.
        if !consent {
            return unavailable(WarpFailureCode::RegistrationFailed);
        }
        let _lock = self.lock.lock().await;
        let state = self.stored_status(paths, expected);
        if state != WarpStatus::Unregistered {
            return state;
        }
        if let Err(code) = verify_binary(&paths.executable, expected) {
            return unavailable(code);
        }
        if !paths.directory.exists() {
            if let Err(code) = acl::create_directory(&paths.directory) {
                return unavailable(code);
            }
        }
        let result = async {
            acl::verify(&paths.directory)?;
            // create_new serializes separate app instances; never remove this on failure.
            let mut marker = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(paths.attempt())
                .map_err(|_| WarpFailureCode::RegistrationFailed)?;
            acl::protect(&paths.attempt())?;
            marker
                .write_all(b"registration-attempted\n")
                .and_then(|_| marker.sync_all())
                .map_err(|_| WarpFailureCode::RegistrationFailed)?;
            let mut command = tokio::process::Command::new(&paths.executable);
            if let Some(fixture) = fixture {
                // Only unit tests can supply a fixture through this private core seam.
                command
                    .args(["--exact", "warp::tests::registration_child", "--ignored"])
                    .env("KRDS_REGISTRATION_FIXTURE", fixture)
                    .env("KRDS_REGISTRATION_CONFIG", paths.config());
            } else {
                command
                    .arg("register")
                    .arg("--accept-tos")
                    .arg("--config")
                    .arg(paths.config());
            }
            command
                .kill_on_drop(true)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            #[cfg(windows)]
            command.creation_flags(0x08000000);
            let mut child = command
                .spawn()
                .map_err(|_| WarpFailureCode::RegistrationFailed)?;
            #[cfg(windows)]
            let _job = match crate::job::JobGuard::assign_pid(
                child.id().ok_or(WarpFailureCode::RegistrationFailed)?,
            ) {
                Ok(job) => job,
                Err(_) => {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(WarpFailureCode::RegistrationFailed);
                }
            };
            match tokio::time::timeout(std::time::Duration::from_secs(60), child.wait()).await {
                Ok(Ok(exit)) if exit.success() => (),
                _ => {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(WarpFailureCode::RegistrationFailed);
                }
            }
            acl::protect(&paths.config())?;
            validate_config(&paths.config())?;
            std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .open(paths.config())
                .and_then(|f| f.sync_all())
                .map_err(|_| WarpFailureCode::RegistrationFailed)?;
            std::fs::remove_file(paths.attempt())
                .map_err(|_| WarpFailureCode::RegistrationFailed)?;
            Ok::<_, WarpFailureCode>(())
        }
        .await;
        match result {
            Ok(()) => ready(),
            Err(code) => unavailable(code),
        }
    }
}

#[cfg(windows)]
fn managed_paths(app: &tauri::AppHandle) -> Result<Paths, String> {
    use tauri::Manager;
    Ok(Paths {
        directory: app
            .path()
            .app_data_dir()
            .map_err(|_| "config-permission")?
            .join("warp"),
        executable: app
            .path()
            .resource_dir()
            .map_err(|_| "binary-missing")?
            .join("binaries/usque.exe"),
    })
}
#[cfg(windows)]
pub fn status(app: &tauri::AppHandle) -> Result<WarpStatus, String> {
    use tauri::Manager;
    Ok(app
        .state::<Registration>()
        .status_at(&managed_paths(app)?, EXE_SHA256))
}
#[cfg(windows)]
pub async fn register(app: &tauri::AppHandle, accept_terms: bool) -> Result<WarpStatus, String> {
    use tauri::Manager;
    Ok(app
        .state::<Registration>()
        .register_at(&managed_paths(app)?, accept_terms, EXE_SHA256, None)
        .await)
}
#[cfg(windows)]
pub fn worker_paths(app: &tauri::AppHandle) -> Result<Option<(PathBuf, PathBuf)>, String> {
    if !matches!(status(app)?, WarpStatus::Ready { .. }) {
        return Ok(None);
    }
    let paths = managed_paths(app)?;
    let configuration = paths.config();
    Ok(Some((paths.executable, configuration)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scan_connection_defaults_to_direct_without_inspecting_warp() {
        #[derive(Deserialize)]
        struct Request {
            #[serde(default)]
            connection: ScanConnection,
        }
        let request: Request = serde_json::from_str("{}").unwrap();
        assert_eq!(request.connection, ScanConnection::Direct);
        assert_eq!(request.connection.worker_args(|| panic!("direct scan inspected WARP")).unwrap(), ["--direct-reason", "operator"]);
        for value in ["null", "42", "\"automatic\"", "{}"] {
            assert!(serde_json::from_str::<ScanConnection>(value).is_err());
        }
    }

    #[test]
    fn explicit_warp_preserves_required_mode_and_surfaces_resource_errors() {
        let selected: ScanConnection = serde_json::from_str("\"warp\"").unwrap();
        assert_eq!(selected.worker_args(|| Ok(None)).unwrap(), ["--require-warp"]);
        assert_eq!(selected.worker_args(|| Ok(Some((PathBuf::from("usque"), PathBuf::from("config.json"))))).unwrap(),
            ["--require-warp", "--warp-executable", "usque", "--warp-config-file", "config.json"]);
        assert_eq!(selected.worker_args(|| Err("WARP_UNSUPPORTED".into())).unwrap_err(), "WARP_UNSUPPORTED");
    }

    #[test]
    fn saved_connection_and_observed_transport_accept_historical_cases() {
        assert!(valid_settings(&serde_json::json!({}), "succeeded"));
        assert!(valid_settings(&serde_json::json!({"connection":"direct","transport":{"kind":"direct","reason":"operator"}}), "succeeded"));
        assert!(valid_settings(&serde_json::json!({"connection":"warp","transport":{"kind":"direct","reason":"owned-origin"}}), "succeeded"));
        for invalid in [serde_json::json!(null), serde_json::json!("automatic"), serde_json::json!({})] {
            assert!(!valid_settings(&serde_json::json!({"connection":invalid}), "succeeded"));
        }
    }
    struct Fixture {
        root: PathBuf,
        paths: Paths,
        hash: String,
    }
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("warp-registration-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&root).unwrap();
            let executable = std::env::current_exe().unwrap();
            let hash = format!("{:x}", Sha256::digest(std::fs::read(&executable).unwrap()));
            Self {
                paths: Paths {
                    directory: root.join("warp"),
                    executable,
                },
                root,
                hash,
            }
        }
        fn count(&self) -> usize {
            std::fs::read_to_string(self.root.join("devices"))
                .unwrap_or_default()
                .lines()
                .count()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
    fn configuration() -> String {
        use base64::Engine;
        // Public test scalar 1 and the standard P-256 generator; no registered device.
        let point = "6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5";
        let decode = |text: &str| {
            (0..text.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
                .collect::<Vec<_>>()
        };
        let key = decode(&format!(
            "30770201010420{}01a00a06082a8648ce3d030107a14403420004{point}",
            "00".repeat(31)
        ));
        let public = base64::engine::general_purpose::STANDARD.encode(decode(&format!(
            "3059301306072a8648ce3d020106082a8648ce3d03010703420004{point}"
        )));
        serde_json::json!({"private_key":base64::engine::general_purpose::STANDARD.encode(key),"endpoint_v4":"192.0.2.1","endpoint_v6":"2001:db8::1","endpoint_h2_v4":"192.0.2.2","endpoint_h2_v6":"2001:db8::2","endpoint_pub_key":format!("-----BEGIN PUBLIC KEY-----\n{public}\n-----END PUBLIC KEY-----"),"id":"test-device","access_token":"test-only-token","ipv4":"192.0.2.3","ipv6":"2001:db8::3"}).to_string()
    }
    #[test]
    #[ignore = "owned local child fixture, launched by registration tests only"]
    fn registration_child() {
        let root = PathBuf::from(
            std::env::var_os("KRDS_REGISTRATION_FIXTURE").expect("fixture root required"),
        );
        let config = PathBuf::from(std::env::var_os("KRDS_REGISTRATION_CONFIG").unwrap());
        // This checks the actual parent DACL before the child creates any config.
        acl::verify(config.parent().unwrap()).unwrap();
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(root.join("devices"))
            .unwrap()
            .write_all(b"device\n")
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
        if root.join("fail-persistence").exists() {
            std::process::exit(7);
        } else {
            std::fs::write(config, configuration()).unwrap();
        }
    }
    #[tokio::test]
    async fn warp_consent_and_overlapping_calls_create_one_device() {
        let fixture = Fixture::new();
        let registration = Registration::default();
        let refused = registration
            .register_at(&fixture.paths, false, &fixture.hash, Some(&fixture.root))
            .await;
        assert_eq!(fixture.count(), 0);
        assert!(matches!(refused, WarpStatus::Unavailable { .. }));
        assert!(!fixture.paths.directory.exists());
        let (first, second, observed) = tokio::join!(
            registration.register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root)),
            registration.register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root)),
            async {
                tokio::time::sleep(std::time::Duration::from_millis(15)).await;
                registration.status_at(&fixture.paths, &fixture.hash)
            }
        );
        assert_eq!(observed, WarpStatus::Registering);
        assert_eq!(first, ready());
        assert_eq!(second, ready());
        assert_eq!(fixture.count(), 1);
        acl::verify(&fixture.paths.directory).unwrap();
        acl::verify(&fixture.paths.config()).unwrap();
        assert_eq!(
            Registration::default().status_at(&fixture.paths, &fixture.hash),
            ready()
        );
    }
    #[tokio::test]
    async fn warp_uncertain_persistence_never_registers_again() {
        let fixture = Fixture::new();
        std::fs::write(fixture.root.join("fail-persistence"), b"1").unwrap();
        let registration = Registration::default();
        let (first, second) = tokio::join!(
            registration.register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root)),
            registration.register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root))
        );
        assert!(matches!(first, WarpStatus::Unavailable { .. }));
        assert!(matches!(second, WarpStatus::Unavailable { .. }));
        let restarted = Registration::default();
        assert_eq!(
            restarted.status_at(&fixture.paths, &fixture.hash),
            unavailable(WarpFailureCode::RegistrationFailed)
        );
        assert_eq!(
            restarted
                .register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root))
                .await,
            unavailable(WarpFailureCode::RegistrationFailed)
        );
        assert_eq!(fixture.count(), 1);
    }
    #[tokio::test]
    async fn warp_binary_verification_precedes_device_creation() {
        let mut fixture = Fixture::new();
        let registration = Registration::default();
        assert_eq!(
            registration
                .register_at(&fixture.paths, true, &"0".repeat(64), Some(&fixture.root))
                .await,
            unavailable(WarpFailureCode::BinaryIntegrity)
        );
        fixture.paths.executable = fixture.root.join("missing.exe");
        assert_eq!(
            registration
                .register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root))
                .await,
            unavailable(WarpFailureCode::BinaryMissing)
        );
        assert_eq!(fixture.count(), 0);
        assert!(!fixture.paths.directory.exists());
    }
    #[test]
    fn warp_malformed_encoded_key_bodies_are_not_ready() {
        use base64::Engine;
        let fixture = Fixture::new();
        acl::create_directory(&fixture.paths.directory).unwrap();
        for field in ["private_key", "endpoint_pub_key"] {
            let mut value: serde_json::Value = serde_json::from_str(&configuration()).unwrap();
            value[field] = if field == "private_key" {
                serde_json::json!(base64::engine::general_purpose::STANDARD.encode([0x30; 40]))
            } else {
                serde_json::json!("-----BEGIN PUBLIC KEY-----\nnot-der\n-----END PUBLIC KEY-----")
            };
            std::fs::write(fixture.paths.config(), serde_json::to_vec(&value).unwrap()).unwrap();
            acl::protect(&fixture.paths.config()).unwrap();
            assert_eq!(
                Registration::default().status_at(&fixture.paths, &fixture.hash),
                unavailable(WarpFailureCode::ConfigInvalid)
            );
        }
        assert_eq!(fixture.count(), 0);
    }
    #[tokio::test]
    async fn warp_invalid_or_insecure_existing_config_is_not_replaced() {
        let fixture = Fixture::new();
        let registration = Registration::default();
        acl::create_directory(&fixture.paths.directory).unwrap();
        std::fs::write(fixture.paths.config(), b"private-invalid-fixture").unwrap();
        acl::protect(&fixture.paths.config()).unwrap();
        assert_eq!(
            registration.status_at(&fixture.paths, &fixture.hash),
            unavailable(WarpFailureCode::ConfigInvalid)
        );
        assert_eq!(
            registration
                .register_at(&fixture.paths, true, &fixture.hash, Some(&fixture.root))
                .await,
            unavailable(WarpFailureCode::ConfigInvalid)
        );
        assert_eq!(fixture.count(), 0);
        assert_eq!(
            std::fs::read(fixture.paths.config()).unwrap(),
            b"private-invalid-fixture"
        );
        // Recreate using inherited access: even an otherwise valid config is rejected.
        std::fs::remove_file(fixture.paths.config()).unwrap();
        std::fs::write(fixture.paths.config(), configuration()).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(
                fixture.paths.config(),
                std::fs::Permissions::from_mode(0o644),
            )
            .unwrap();
        }
        assert_eq!(
            registration.status_at(&fixture.paths, &fixture.hash),
            unavailable(WarpFailureCode::ConfigPermission)
        );
        assert_eq!(fixture.count(), 0);
    }
    #[test]
    fn warp_metadata_rejects_extra_fields_and_unknown_codes() {
        for value in [
            serde_json::json!({"transport":{"kind":"warp","backend":"usque","version":"4.2.1","token":"private"}}),
            serde_json::json!({"transportFailure":{"code":"secret-message","scope":"incomplete"}}),
        ] {
            assert!(!valid_settings(&value, "failed"));
        }
        assert!(valid_settings(&serde_json::json!({}), "succeeded"));
    }
}
