//! Linux-only, opt-in resource staging. The parent CLI/rustc configuration is never changed.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::os::unix::fs::DirBuilderExt;
use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    ffi::OsString,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::unix::{
        fs::{MetadataExt, OpenOptionsExt, PermissionsExt},
        io::AsRawFd,
    },
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{Duration, Instant},
};
use tauri_utils::{
    config::{BundleResources, Config},
    resources::ResourcePaths,
};

type Result<T> = std::result::Result<T, String>;
const CHUNK: usize = 16 * 1024;
const MAX_FILES: usize = 4096;
const MAX_TOTAL: u64 = 2 * 1024 * 1024 * 1024;
const MAX_FILE: u64 = 1280 * 1024 * 1024;
const MAX_JSON: u64 = 2 * 1024 * 1024;
static NEXT: AtomicU64 = AtomicU64::new(0);
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn need(ok: bool, message: &str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(message.into())
    }
}
fn hex(bytes: impl AsRef<[u8]>) -> String {
    bytes.as_ref().iter().map(|b| format!("{b:02x}")).collect()
}
fn safe(path: &str) -> Result<()> {
    need(
        !path.is_empty()
            && path.chars().all(|c| !c.is_control())
            && !path.contains(['\\', ':', '\0'])
            && path
                .split('/')
                .all(|p| !p.is_empty() && p != "." && p != ".." && !p.ends_with(['.', ' '])),
        "unsafe relative resource path",
    )
}
fn regular(root: &Path, path: &Path) -> Result<fs::Metadata> {
    let rel = path.strip_prefix(root).map_err(err)?;
    let mut current = root.to_path_buf();
    need(
        !fs::symlink_metadata(root)
            .map_err(err)?
            .file_type()
            .is_symlink(),
        "root symlink",
    )?;
    for part in rel.components() {
        current.push(part);
        need(
            !fs::symlink_metadata(&current)
                .map_err(err)?
                .file_type()
                .is_symlink(),
            "resource symlink",
        )?;
    }
    let m = fs::symlink_metadata(path).map_err(err)?;
    need(m.is_file(), "resource is not regular")?;
    Ok(m)
}
fn identity(m: &fs::Metadata) -> (u64, u64, u64, i64, i64, i64, i64) {
    (
        m.dev(),
        m.ino(),
        m.len(),
        m.mtime(),
        m.mtime_nsec(),
        m.ctime(),
        m.ctime_nsec(),
    )
}
fn read_json(path: &Path) -> Result<(Value, Vec<u8>)> {
    let m = fs::symlink_metadata(path).map_err(err)?;
    need(
        m.is_file() && !m.file_type().is_symlink() && m.len() <= MAX_JSON,
        "manifest type/size",
    )?;
    let bytes = fs::read(path).map_err(err)?;
    let v = serde_json::from_slice(&bytes).map_err(err)?;
    Ok((v, bytes))
}
struct Budget {
    start: Instant,
    last_copy: Instant,
    copy_bytes: u64,
    deadline: Duration,
    copy_rate: u64,
    #[cfg(test)]
    abort_after_bytes: Option<u64>,
}
impl Budget {
    fn new() -> Self {
        Self {
            start: Instant::now(),
            last_copy: Instant::now(),
            copy_bytes: 0,
            deadline: Duration::from_secs(1200),
            copy_rate: 2 * 1024 * 1024,
            #[cfg(test)]
            abort_after_bytes: None,
        }
    }
    fn check(&self) -> Result<()> {
        need(
            self.start.elapsed() < self.deadline,
            "resource staging deadline",
        )
    }
    fn copied(&mut self, n: usize) -> Result<()> {
        self.check()?;
        #[cfg(test)]
        if let Some(left) = self.abort_after_bytes.as_mut() {
            *left = left.saturating_sub(n as u64);
            need(*left > 0, "fixture copy interrupted")?;
        }
        self.copy_bytes += n as u64;
        if self.copy_bytes >= 1024 * 1024 {
            let due = Duration::from_secs_f64(self.copy_bytes as f64 / self.copy_rate as f64);
            if let Some(delay) = due.checked_sub(self.last_copy.elapsed()) {
                thread::sleep(delay);
            }
            self.last_copy = Instant::now();
            self.copy_bytes = 0;
        }
        Ok(())
    }
}
fn digest_file(root: &Path, path: &Path, budget: &Budget) -> Result<(String, u64)> {
    let before = regular(root, path)?;
    let mut f = OpenOptions::new()
        .read(true)
        .custom_flags(0x20000)
        .open(path)
        .map_err(err)?; // Linux O_NOFOLLOW
    need(
        identity(&before) == identity(&f.metadata().map_err(err)?),
        "resource replaced during open",
    )?;
    let mut h = Sha256::new();
    let mut n = 0;
    let mut buf = [0; CHUNK];
    loop {
        budget.check()?;
        let got = f.read(&mut buf).map_err(err)?;
        if got == 0 {
            break;
        }
        n += got as u64;
        need(n <= MAX_FILE, "resource file budget")?;
        h.update(&buf[..got]);
    }
    need(
        identity(&before) == identity(&regular(root, path)?),
        "resource changed during hash",
    )?;
    Ok((hex(h.finalize()), n))
}
#[derive(Clone, Debug)]
struct Entry {
    source: PathBuf,
    relative: String,
    size: u64,
    sha: String,
    mode: u32,
}
#[derive(Default, Debug)]
struct Stats {
    copied: u64,
    reused: u64,
    bytes: u64,
    preserved: Vec<String>,
    verified: BTreeMap<String, (u64, u64, u64, i64, i64, i64, i64)>,
    source_verified: BTreeMap<String, (u64, u64, u64, i64, i64, i64, i64)>,
}
fn mkdirs(root: &Path, relative: &Path) -> Result<()> {
    let mut p = root.to_path_buf();
    for c in relative.components() {
        p.push(c);
        if !p.exists() {
            fs::create_dir(&p).map_err(err)?;
        }
        let m = fs::symlink_metadata(&p).map_err(err)?;
        need(
            m.is_dir() && !m.file_type().is_symlink(),
            "destination directory/link",
        )?;
    }
    Ok(())
}
struct VerifiedOutput {
    file: File,
}
fn owned_complete(
    root: &Path,
    entry: &Entry,
    path: &Path,
    budget: &Budget,
) -> Result<VerifiedOutput> {
    let sm = regular(entry.source.parent().ok_or("source parent")?, &entry.source)?;
    let dm = regular(root, path)?;
    unsafe extern "C" {
        fn geteuid() -> u32;
    }
    need(
        dm.uid() == unsafe { geteuid() } && dm.nlink() == 1,
        "output must be privately owned and unshared",
    )?;
    need(
        (sm.dev(), sm.ino()) != (dm.dev(), dm.ino()),
        "source/output inode alias",
    )?;
    need(
        dm.len() == entry.size && dm.mode() & 0o777 == entry.mode,
        "output size/mode",
    )?;
    let (hash, n) = digest_file(root, path, budget)?;
    need(hash == entry.sha && n == entry.size, "output checksum")?;
    let f = OpenOptions::new()
        .read(true)
        .custom_flags(0x20000)
        .open(path)
        .map_err(err)?;
    need(
        identity(&dm) == identity(&f.metadata().map_err(err)?),
        "output changed after verification",
    )?;
    Ok(VerifiedOutput { file: f })
}
fn hint_complete(file: &VerifiedOutput) -> Result<()> {
    finish_verified(
        file,
        |f| f.sync_all().map_err(err),
        |fd| {
            unsafe extern "C" {
                fn posix_fadvise(fd: i32, offset: i64, len: i64, advice: i32) -> i32;
            }
            let rc = unsafe { posix_fadvise(fd, 0, 0, 4) };
            need(
                rc == 0,
                &format!("completed-output cache hint failed: {rc}"),
            )
        },
    )
}
fn finish_verified(
    output: &VerifiedOutput,
    sync: impl FnOnce(&File) -> Result<()>,
    hint: impl FnOnce(i32) -> Result<()>,
) -> Result<()> {
    sync(&output.file)?;
    hint(output.file.as_raw_fd())
}
fn publish_verified(temp: &Path, destination: &Path, proof: &VerifiedOutput) -> Result<()> {
    need(
        identity(&fs::symlink_metadata(temp).map_err(err)?)
            == identity(&proof.file.metadata().map_err(err)?),
        "verified temp replaced",
    )?;
    // Both paths are owned outputs on the same filesystem. link publishes with
    // no replacement; it never aliases an original input into Cargo's output.
    fs::hard_link(temp, destination).map_err(err)?;
    fs::remove_file(temp).map_err(err)?;
    File::open(destination.parent().ok_or("destination parent")?)
        .map_err(err)?
        .sync_all()
        .map_err(err)
}
fn check_pending_base(target: &Path, evidence: &Path, entries: &[Entry]) -> Result<()> {
    let tm = fs::symlink_metadata(target).map_err(err)?;
    let em = fs::symlink_metadata(evidence).map_err(err)?;
    need(
        tm.is_dir() && !tm.file_type().is_symlink() && em.is_dir() && !em.file_type().is_symlink(),
        "pending base directory/link",
    )?;
    need(
        tm.dev() == em.dev(),
        "pending and target must be on the same filesystem",
    )?;
    let target = target.canonicalize().map_err(err)?;
    let evidence = evidence.canonicalize().map_err(err)?;
    need(
        !target.starts_with(&evidence),
        "pending base overlaps target",
    )?;
    for entry in entries {
        let active = target.join(
            entry
                .relative
                .split('/')
                .next()
                .ok_or("resource namespace")?,
        );
        need(
            !evidence.starts_with(active),
            "pending base overlaps active resource subtree",
        )?;
    }
    Ok(())
}
fn new_pending(evidence: &Path) -> Result<PathBuf> {
    let pending = evidence.join(format!(
        "pending-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    fs::DirBuilder::new()
        .mode(0o700)
        .create(&pending)
        .map_err(err)?;
    File::open(evidence).map_err(err)?.sync_all().map_err(err)?;
    println!(
        "cargo:warning=bounded resource pending: {}",
        pending.display()
    );
    Ok(pending)
}
fn stage(entries: &[Entry], target: &Path, evidence: &Path, budget: &mut Budget) -> Result<Stats> {
    need(entries.len() <= MAX_FILES, "resource count")?;
    let total = entries.iter().try_fold(0u64, |sum, e| {
        sum.checked_add(e.size).ok_or("resource size overflow")
    })?;
    need(
        total <= MAX_TOTAL && entries.iter().all(|e| e.size <= MAX_FILE),
        "resource bytes budget",
    )?;
    let mut names = BTreeSet::new();
    for e in entries {
        safe(&e.relative)?;
        need(
            names.insert(e.relative.to_lowercase()),
            "resource target collision",
        )?;
    }
    check_pending_base(target, evidence, entries)?;
    let mut pending_root: Option<PathBuf> = None;
    let mut stats = Stats::default();
    for e in entries {
        budget.check()?;
        let dst = target.join(&e.relative);
        mkdirs(
            target,
            Path::new(&e.relative).parent().ok_or("target parent")?,
        )?;
        let source_root = e.source.parent().ok_or("source parent")?;
        let source_id = identity(&regular(source_root, &e.source)?);
        let (source_hash, n) = digest_file(source_root, &e.source, budget)?;
        need(source_hash == e.sha && n == e.size, "source checksum/size")?;
        need(
            source_id == identity(&regular(source_root, &e.source)?),
            "source changed after hash",
        )?;
        stats.source_verified.insert(e.relative.clone(), source_id);
        if dst.exists() || fs::symlink_metadata(&dst).is_ok() {
            // No symlink/alias is ever moved, overwritten or cache-hinted.
            let sm = regular(source_root, &e.source)?;
            let dm = regular(target, &dst)?;
            need(
                (sm.dev(), sm.ino()) != (dm.dev(), dm.ino()),
                "source/output inode alias",
            )?;
            match owned_complete(target, e, &dst, budget) {
                Ok(f) => {
                    hint_complete(&f)?;
                    stats.verified.insert(
                        e.relative.clone(),
                        identity(&f.file.metadata().map_err(err)?),
                    );
                    stats.reused += 1;
                    stats.bytes += e.size;
                    continue;
                }
                Err(error) if error == "output checksum" || error == "output size/mode" => {}
                Err(error) => return Err(error),
            }
            mkdirs(
                evidence,
                Path::new(&e.relative).parent().ok_or("backup parent")?,
            )?;
            let old = evidence.join(&e.relative);
            need(!old.exists(), "preservation path exists")?;
            fs::rename(&dst, &old).map_err(err)?;
            stats.preserved.push(e.relative.clone());
        }
        let pending = match &pending_root {
            Some(path) => path.clone(),
            None => {
                let path = new_pending(evidence)?;
                pending_root = Some(path.clone());
                path
            }
        };
        let tmp = pending.join(format!(
            "resource-{}.part",
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        // Preserve a failed temp as evidence. It can never be classified as complete.
        let before = regular(source_root, &e.source)?;
        let mut input = OpenOptions::new()
            .read(true)
            .custom_flags(0x20000)
            .open(&e.source)
            .map_err(err)?;
        need(
            identity(&before) == identity(&input.metadata().map_err(err)?),
            "source changed before copy",
        )?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&tmp)
            .map_err(err)?;
        let mut h = Sha256::new();
        let mut size = 0;
        let mut sync = 0;
        let mut buf = [0; CHUNK];
        loop {
            let n = input.read(&mut buf).map_err(err)?;
            if n == 0 {
                break;
            }
            size += n as u64;
            need(size <= e.size, "copy exceeds pinned size")?;
            output.write_all(&buf[..n]).map_err(err)?;
            h.update(&buf[..n]);
            budget.copied(n)?;
            sync += n;
            if sync >= 8 * 1024 * 1024 {
                output.sync_data().map_err(err)?;
                sync = 0;
            }
        }
        need(
            size == e.size && hex(h.finalize()) == e.sha,
            "copied source checksum/size",
        )?;
        need(
            identity(&before) == identity(&regular(source_root, &e.source)?),
            "source changed during copy",
        )?;
        output
            .set_permissions(fs::Permissions::from_mode(e.mode))
            .map_err(err)?;
        output.sync_all().map_err(err)?;
        drop(output);
        let f = owned_complete(&pending, e, &tmp, budget)?;
        hint_complete(&f)?;
        publish_verified(&tmp, &dst, &f)?;
        drop(f);
        stats
            .verified
            .insert(e.relative.clone(), identity(&regular(target, &dst)?));
        stats.copied += 1;
        stats.bytes += e.size;
    }
    // Full bytes were verified per file. Bind the final complete set to those unchanged identities.
    let expected = entries
        .iter()
        .map(|e| e.relative.clone())
        .collect::<BTreeSet<_>>();
    for e in entries {
        need(
            stats.verified.get(&e.relative)
                == Some(&identity(&regular(target, &target.join(&e.relative))?)),
            "verified output changed",
        )?;
        need(
            stats.source_verified.get(&e.relative)
                == Some(&identity(&regular(e.source.parent().unwrap(), &e.source)?)),
            "verified source changed",
        )?;
    }
    let roots = entries
        .iter()
        .filter(|e| e.relative.contains('/'))
        .map(|e| e.relative.split('/').next().unwrap().to_string())
        .collect::<BTreeSet<_>>();
    let mut stack = roots
        .into_iter()
        .map(|r| target.join(r))
        .collect::<Vec<_>>();
    let mut count = 0;
    while let Some(dir) = stack.pop() {
        for child in fs::read_dir(dir).map_err(err)? {
            let child = child.map_err(err)?;
            let path = child.path();
            let meta = fs::symlink_metadata(&path).map_err(err)?;
            need(!meta.file_type().is_symlink(), "output tree symlink")?;
            if meta.is_dir() {
                stack.push(path);
            } else {
                count += 1;
                need(count <= MAX_FILES, "output count budget")?;
                let rel = path
                    .strip_prefix(target)
                    .map_err(err)?
                    .to_str()
                    .ok_or("output UTF8")?
                    .replace('\\', "/");
                need(
                    meta.is_file() && expected.contains(&rel),
                    "unexpected output resource",
                )?;
            }
        }
    }
    if let Some(pending) = pending_root {
        fs::remove_dir(&pending).map_err(err)?;
        File::open(evidence).map_err(err)?.sync_all().map_err(err)?;
    }
    Ok(stats)
}
fn add(
    table: &mut BTreeMap<String, (u64, String)>,
    name: String,
    size: u64,
    sha: String,
) -> Result<()> {
    safe(&name)?;
    need(
        sha.len() == 64
            && sha
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)),
        "manifest SHA format",
    )?;
    need(table.len() < MAX_FILES, "manifest resource count")?;
    need(
        table.insert(name, (size, sha)).is_none(),
        "duplicate expected resource",
    )
}
fn table_rows(table: &mut BTreeMap<String, (u64, String)>, rows: &Value) -> Result<()> {
    for r in rows.as_array().ok_or("resource inventory array")? {
        add(
            table,
            r["path"].as_str().ok_or("resource path")?.into(),
            r["size"].as_u64().ok_or("resource size")?,
            r["sha256"].as_str().ok_or("resource digest")?.into(),
        )?;
    }
    Ok(())
}
fn source_path(path: &str) -> bool {
    (path.starts_with("apps/")
        || path.starts_with("packages/")
        || path.starts_with("scripts/")
        || path.starts_with("src-tauri/")
        || ["package.json", "package-lock.json", "rust-toolchain.toml"].contains(&path))
        && !path
            .split('/')
            .any(|p| ["dist", "target", "binaries", "gen"].contains(&p))
        && !path.ends_with(".tsbuildinfo")
}
fn verify_source(root: &Path, manifest: &Value, budget: &Budget) -> Result<()> {
    let git = |args: &[&str]| -> Result<Vec<u8>> {
        let result = std::process::Command::new("git")
            .args(["--no-optional-locks", "-C"])
            .arg(root)
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .map_err(err)?;
        need(result.status.success(), "git source identity")?;
        Ok(result.stdout)
    };
    let head = String::from_utf8(git(&["rev-parse", "HEAD"])?).map_err(err)?;
    need(
        manifest["source"]["commit"].as_str() == Some(head.trim()),
        "stale source commit",
    )?;
    let actual = String::from_utf8(git(&[
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
    ])?)
    .map_err(err)?
    .split('\0')
    .filter(|s| source_path(s))
    .map(String::from)
    .collect::<BTreeSet<_>>();
    let mut seen = BTreeSet::new();
    let mut h = Sha256::new();
    for row in manifest["source"]["sourceFiles"]
        .as_array()
        .ok_or("source inventory")?
    {
        let rel = row["path"].as_str().ok_or("source path")?;
        safe(rel)?;
        need(seen.insert(rel.to_string()), "duplicate source")?;
        let (digest, _) = digest_file(root, &root.join(rel), budget)?;
        need(
            row["sha256"].as_str() == Some(&digest),
            "source identity changed",
        )?;
        h.update(rel.as_bytes());
        h.update([0]);
        h.update(digest.as_bytes());
    }
    need(
        !seen.is_empty() && seen == actual,
        "source file set changed",
    )?;
    need(
        manifest["source"]["sourceSha256"].as_str() == Some(&hex(h.finalize())),
        "source identity digest",
    )
}
fn expected(root: &Path, budget: &Budget) -> Result<BTreeMap<String, (u64, String)>> {
    let binaries = root.join("binaries");
    let (m, mb) = read_json(&binaries.join("build-manifest.json"))?;
    let (runtime, rb) = read_json(&binaries.join("resources-manifest.json"))?;
    verify_source(root.parent().ok_or("repository root")?, &m, budget)?;
    let repo = root.parent().ok_or("repository root")?;
    for (key, rel) in [
        ("npm", "package-lock.json"),
        ("cargo", "src-tauri/Cargo.lock"),
        ("runtime", "scripts/windows-runtime.lock.json"),
    ] {
        let (digest, _) = digest_file(repo, &repo.join(rel), budget)?;
        need(
            m["lockfiles"][key].as_str() == Some(&digest),
            "stale source lock identity",
        )?;
    }
    let mut result = BTreeMap::new();
    table_rows(&mut result, &runtime["files"])?;
    table_rows(&mut result, &m["workers"])?;
    need(
        m["lockfiles"]["runtime"].as_str() == Some(&hex(Sha256::digest(&rb))),
        "runtime manifest not pinned",
    )?;
    add(
        &mut result,
        "build-manifest.json".into(),
        mb.len() as u64,
        hex(Sha256::digest(&mb)),
    )?;
    add(
        &mut result,
        "resources-manifest.json".into(),
        rb.len() as u64,
        hex(Sha256::digest(&rb)),
    )?;
    for (name, pointer) in [
        ("libunwind.dll", "/releaseInputs/loaders/libunwind"),
        ("WebView2Loader.dll", "/releaseInputs/loaders/webview2"),
        ("llvm-LICENSE", "/releaseInputs/llvm/licenseSha256"),
    ] {
        let p = binaries.join(name);
        let size = regular(&binaries, &p)?.len();
        add(
            &mut result,
            name.into(),
            size,
            m.pointer(pointer)
                .and_then(Value::as_str)
                .ok_or("gnullvm loader provenance missing")?
                .into(),
        )?;
    }
    Ok(result)
}
fn merge(to: &mut Value, patch: &Value) {
    if let Value::Object(map) = patch {
        if !to.is_object() {
            *to = json!({});
        }
        for (k, v) in map {
            if v.is_null() {
                to.as_object_mut().unwrap().remove(k);
            } else {
                merge(
                    to.as_object_mut().unwrap().entry(k).or_insert(Value::Null),
                    v,
                );
            }
        }
    } else {
        *to = patch.clone();
    }
}
fn suppressed_override(original: Option<&str>) -> Result<String> {
    let mut v: Value = serde_json::from_str(original.unwrap_or("{}")).map_err(err)?;
    need(v.is_object(), "TAURI_CONFIG object required")?;
    if !v.get("bundle").is_some_and(Value::is_object) {
        v["bundle"] = json!({});
    }
    v["bundle"]["resources"] = Value::Null;
    serde_json::to_string(&v).map_err(err)
}
fn with_suppressed<T>(run: impl FnOnce() -> Result<T>) -> Result<T> {
    struct Restore(Option<OsString>);
    impl Drop for Restore {
        fn drop(&mut self) {
            unsafe {
                match &self.0 {
                    Some(v) => env::set_var("TAURI_CONFIG", v),
                    None => env::remove_var("TAURI_CONFIG"),
                }
            }
        }
    }
    let old = env::var_os("TAURI_CONFIG");
    let next = suppressed_override(
        old.as_ref()
            .map(|v| v.to_str().ok_or("non-UTF8 TAURI_CONFIG"))
            .transpose()?,
    )?;
    let _restore = Restore(old);
    unsafe { env::set_var("TAURI_CONFIG", next) };
    run()
}
/// Called only by the explicit Linux64 bounded build path. All other builds use tauri-build directly.
pub fn build() -> Result<()> {
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").ok_or("CARGO_MANIFEST_DIR")?)
        .canonicalize()
        .map_err(err)?;
    need(
        env::current_dir()
            .map_err(err)?
            .canonicalize()
            .map_err(err)?
            == root,
        "Cargo build-script working directory",
    )?;
    let target = env::var("TARGET").map_err(err)?;
    need(
        target == "x86_64-pc-windows-gnullvm",
        "bounded staging supports Windows gnullvm only",
    )?;
    let (mut value, _) = tauri_utils::config::parse::read_from(
        tauri_utils::platform::Target::from_triple(&target),
        &root,
    )
    .map_err(err)?;
    if let Ok(v) = env::var("TAURI_CONFIG") {
        merge(&mut value, &serde_json::from_str::<Value>(&v).map_err(err)?);
    }
    let config: Config = serde_json::from_value(value.clone()).map_err(err)?;
    need(
        config.bundle.external_bin.is_none(),
        "bounded external binaries unsupported",
    )?;
    need(
        !matches!(
            config.bundle.windows.webview_install_mode,
            tauri_utils::config::WebviewInstallMode::FixedRuntime { .. }
        ),
        "bounded fixed WebView runtime unsupported",
    )?;
    let out = PathBuf::from(env::var_os("OUT_DIR").ok_or("OUT_DIR")?)
        .canonicalize()
        .map_err(err)?;
    let target_dir = out
        .ancestors()
        .find(|p| p.file_name() == Some(std::ffi::OsStr::new("build")))
        .and_then(Path::parent)
        .ok_or("Cargo target directory")?
        .canonicalize()
        .map_err(err)?;
    let source_dir = root.join("binaries").canonicalize().map_err(err)?;
    need(
        target_dir != root
            && !source_dir.starts_with(&target_dir)
            && !target_dir.starts_with(&source_dir),
        "source/target tree overlap",
    )?;
    let mut budget = Budget::new();
    let mut table = expected(&root, &budget)?;
    let source_root = root.join("binaries").canonicalize().map_err(err)?;
    let resources = config
        .bundle
        .resources
        .as_ref()
        .ok_or("resource map missing")?;
    let paths = match resources {
        BundleResources::Map(m) => ResourcePaths::from_map(m, true),
        BundleResources::List(v) => ResourcePaths::new(v, true),
    };
    let mut iter = paths.iter();
    let mut entries = Vec::new();
    for row in iter.by_ref() {
        let row = row.map_err(err)?;
        let source = row.path();
        let source = if source.is_absolute() {
            source.to_path_buf()
        } else {
            root.join(source)
        };
        regular(&source_root, &source)?;
        let source = source.canonicalize().map_err(err)?;
        need(source.starts_with(&source_root), "resource source escape")?;
        let name = source
            .strip_prefix(&source_root)
            .map_err(err)?
            .to_str()
            .ok_or("resource UTF8")?
            .replace('\\', "/");
        let (size, sha) = table
            .remove(&name)
            .ok_or("resource absent from verified manifest")?;
        let relative = row
            .target()
            .to_str()
            .ok_or("resource target UTF8")?
            .replace('\\', "/");
        safe(&relative)?;
        need(entries.len() < MAX_FILES, "resource mapping count")?;
        need(
            regular(&source_root, &source)?.mode() & 0o7000 == 0,
            "special resource mode",
        )?;
        entries.push(Entry {
            mode: regular(&source_root, &source)?.mode() & 0o777,
            source,
            relative,
            size,
            sha,
        });
    }
    need(
        !entries.is_empty() && table.is_empty(),
        "resource mapping/manifest set mismatch",
    )?;
    for p in iter.rerun_if_changed() {
        println!("cargo:rerun-if-changed={}", p.display());
    }
    for e in &entries {
        println!("cargo:rerun-if-changed={}", e.source.display());
    }
    entries.sort_by(|a, b| a.relative.cmp(&b.relative));
    let evidence = out.join(format!(
        "resource-stage-preserved-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    fs::create_dir(&evidence).map_err(err)?;
    let stats = stage(&entries, &target_dir, &evidence, &mut budget)?;
    verify_source(
        root.parent().unwrap(),
        &read_json(&root.join("binaries/build-manifest.json"))?.0,
        &budget,
    )?;
    let receipt = json!({"status":"resources verified, upstream build pending","copied":stats.copied,"reused":stats.reused,"bytes":stats.bytes,"preserved":stats.preserved,"configSha256":hex(Sha256::digest(serde_json::to_vec(&value).map_err(err)?)),"files":entries.iter().map(|e|json!({"path":e.relative,"size":e.size,"sha256":e.sha})).collect::<Vec<_>>()});
    let path = out.join(format!(
        "resource-stage-{}-{}.json",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(err)?;
    file.write_all(serde_json::to_string(&receipt).map_err(err)?.as_bytes())
        .map_err(err)?;
    file.sync_all().map_err(err)?;
    // Only the resource list differs in this process. ACL/manifest/icons/metadata and
    // the rest of try_build still run. Parent rustc/CLI retains the original config.
    with_suppressed(|| tauri_build::try_build(tauri_build::Attributes::default()).map_err(err))
}
#[cfg(test)]
#[path = "resource_stage_tests.rs"]
mod tests;
