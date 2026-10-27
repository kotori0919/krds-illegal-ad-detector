use super::*;
struct Fixture {
    root: PathBuf,
    source: PathBuf,
    target: PathBuf,
    evidence: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let root = env::temp_dir().join(format!(
            "krds-resource-fixture-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir(&root).unwrap();
        for p in ["source", "target", "evidence"] {
            fs::create_dir(root.join(p)).unwrap();
        }
        Self {
            source: root.join("source"),
            target: root.join("target"),
            evidence: root.join("evidence"),
            root,
        }
    }
    fn entry(&self, name: &str) -> Entry {
        let path = self.source.join(name);
        if let Some(p) = path.parent() {
            fs::create_dir_all(p).unwrap();
        }
        fs::write(&path, b"abc").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o640)).unwrap();
        Entry {
            source: path,
            relative: name.into(),
            size: 3,
            sha: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".into(),
            mode: 0o640,
        }
    }
    fn budget(&self) -> Budget {
        let mut b = Budget::new();
        b.copy_rate = u64::MAX;
        b
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}
#[test]
fn copy_and_reuse_are_verified_and_preserve_source() {
    let f = Fixture::new();
    let e = f.entry("a");
    let before = identity(&fs::metadata(&e.source).unwrap());
    let a = stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).unwrap();
    assert_eq!((a.copied, a.reused, a.bytes), (1, 0, 3));
    assert_eq!(fs::read(f.target.join("a")).unwrap(), b"abc");
    assert_eq!(
        fs::metadata(f.target.join("a")).unwrap().mode() & 0o777,
        0o640
    );
    let id = fs::metadata(f.target.join("a")).unwrap().ino();
    let b = stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).unwrap();
    assert_eq!((b.copied, b.reused), (0, 1));
    assert_eq!(fs::metadata(f.target.join("a")).unwrap().ino(), id);
    assert_eq!(identity(&fs::metadata(e.source).unwrap()), before);
}
#[test]
fn same_size_corruption_and_truncation_are_preserved() {
    for bytes in [b"bad".as_slice(), b"a".as_slice()] {
        let f = Fixture::new();
        let e = f.entry("a");
        fs::write(f.target.join("a"), bytes).unwrap();
        fs::set_permissions(f.target.join("a"), fs::Permissions::from_mode(0o640)).unwrap();
        let d = stage(&[e], &f.target, &f.evidence, &mut f.budget()).unwrap();
        assert_eq!(d.preserved, ["a"]);
        assert_eq!(fs::read(f.evidence.join("a")).unwrap(), bytes);
        assert_eq!(fs::read(f.target.join("a")).unwrap(), b"abc");
    }
}
#[test]
fn changed_source_fails_without_copy() {
    let f = Fixture::new();
    let e = f.entry("a");
    fs::write(&e.source, b"bad").unwrap();
    assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget())
        .unwrap_err()
        .contains("source checksum"));
    assert!(!f.target.join("a").exists());
}
#[test]
fn path_and_collision_checks_precede_writes() {
    for name in [
        "../escape",
        "/escape",
        "C:/escape",
        "a/./b",
        "a\\b",
        "a/",
        "a.",
        "a\nmetadata",
    ] {
        let f = Fixture::new();
        let mut e = f.entry("a");
        e.relative = name.into();
        assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget()).is_err());
        assert_eq!(fs::read_dir(&f.target).unwrap().count(), 0);
    }
    let f = Fixture::new();
    let a = f.entry("a");
    let mut b = a.clone();
    b.relative = "A".into();
    assert!(stage(&[a, b], &f.target, &f.evidence, &mut f.budget())
        .unwrap_err()
        .contains("collision"));
}
#[test]
fn symlink_and_hardlink_never_touch_source() {
    for hard in [true, false] {
        let f = Fixture::new();
        let e = f.entry("a");
        if hard {
            fs::hard_link(&e.source, f.target.join("a")).unwrap();
        } else {
            std::os::unix::fs::symlink(&e.source, f.target.join("a")).unwrap();
        }
        assert!(stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).is_err());
        assert_eq!(fs::read(e.source).unwrap(), b"abc");
        assert_eq!(fs::read_dir(&f.evidence).unwrap().count(), 0);
    }
}
#[test]
fn output_directory_symlink_is_rejected() {
    let f = Fixture::new();
    let e = f.entry("sub/a");
    std::os::unix::fs::symlink(&f.source, f.target.join("sub")).unwrap();
    assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget()).is_err());
}
#[test]
fn unexpected_output_is_not_accepted() {
    let f = Fixture::new();
    let e = f.entry("sub/a");
    fs::create_dir(f.target.join("sub")).unwrap();
    fs::write(f.target.join("sub/extra"), b"x").unwrap();
    assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget())
        .unwrap_err()
        .contains("unexpected"));
}
#[test]
fn deadlines_and_budgets_fail_closed() {
    let f = Fixture::new();
    let mut e = f.entry("a");
    let mut budget = f.budget();
    budget.deadline = Duration::ZERO;
    assert!(stage(&[e.clone()], &f.target, &f.evidence, &mut budget).is_err());
    e.size = MAX_TOTAL + 1;
    assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget()).is_err());
}
#[test]
fn complete_hint_does_not_change_bytes_or_mode() {
    let f = Fixture::new();
    let e = f.entry("a");
    stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).unwrap();
    let file = owned_complete(&f.target, &e, &f.target.join("a"), &f.budget()).unwrap();
    hint_complete(&file).unwrap();
    assert_eq!(fs::read(f.target.join("a")).unwrap(), b"abc");
    assert_eq!(file.file.metadata().unwrap().mode() & 0o777, 0o640);
    let mut bad = e;
    bad.sha = "0".repeat(64);
    assert!(owned_complete(&f.target, &bad, &f.target.join("a"), &f.budget()).is_err());
}
#[test]
fn only_resources_are_suppressed_and_env_is_restored() {
    let old = env::var_os("TAURI_CONFIG");
    let original =
        r#"{"bundle":{"resources":{"a":"b"},"active":true},"app":{"security":{"csp":"self"}}}"#;
    unsafe { env::set_var("TAURI_CONFIG", original) };
    let outcome: Result<()> = with_suppressed(|| {
        let override_config: Value =
            serde_json::from_str(&env::var("TAURI_CONFIG").unwrap()).unwrap();
        let mut base: Value = serde_json::from_str(original).unwrap();
        merge(&mut base, &override_config);
        assert!(base["bundle"].get("resources").is_none());
        assert_eq!(base["bundle"]["active"], true);
        assert_eq!(base["app"]["security"]["csp"], "self");
        Err("upstream validation failure".into())
    });
    assert_eq!(outcome.unwrap_err(), "upstream validation failure");
    assert_eq!(env::var("TAURI_CONFIG").unwrap(), original);
    unsafe {
        match old {
            Some(v) => env::set_var("TAURI_CONFIG", v),
            None => env::remove_var("TAURI_CONFIG"),
        }
    }
}
#[test]
fn resourcepaths_map_destination_contract() {
    let f = Fixture::new();
    let e = f.entry("a");
    let map = std::collections::HashMap::from([(
        f.source.to_string_lossy().into_owned(),
        "binaries/".into(),
    )]);
    let rows = ResourcePaths::from_map(&map, true)
        .iter()
        .collect::<std::result::Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].path().canonicalize().unwrap(), e.source);
    assert_eq!(rows[0].target(), Path::new("binaries/a"));
}
#[test]
fn manifest_duplicate_and_digest_format_rejected() {
    let mut table = BTreeMap::new();
    assert!(add(&mut table, "../x".into(), 0, "0".repeat(64)).is_err());
    assert!(add(&mut table, "x".into(), 0, "Z".repeat(64)).is_err());
    add(&mut table, "x".into(), 0, "0".repeat(64)).unwrap();
    assert!(add(&mut table, "x".into(), 0, "0".repeat(64)).is_err());
}
#[test]
fn hint_order_and_failures_are_explicit() {
    let f = Fixture::new();
    let e = f.entry("a");
    stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).unwrap();
    let verified = owned_complete(&f.target, &e, &f.target.join("a"), &f.budget()).unwrap();
    let calls = std::cell::RefCell::new(Vec::new());
    finish_verified(
        &verified,
        |_| {
            calls.borrow_mut().push("sync");
            Ok(())
        },
        |_| {
            calls.borrow_mut().push("hint");
            Ok(())
        },
    )
    .unwrap();
    assert_eq!(*calls.borrow(), ["sync", "hint"]);
    calls.borrow_mut().clear();
    assert!(finish_verified(
        &verified,
        |_| Err("sync error".into()),
        |_| {
            calls.borrow_mut().push("hint");
            Ok(())
        }
    )
    .is_err());
    assert!(calls.borrow().is_empty());
    assert!(
        finish_verified(&verified, |_| Ok(()), |_| Err("unsupported hint".into()))
            .unwrap_err()
            .contains("unsupported")
    );
}
#[test]
fn stale_source_identity_and_file_set_are_rejected() {
    let f = Fixture::new();
    fs::create_dir(f.source.join("scripts")).unwrap();
    fs::write(f.source.join("scripts/proof.mjs"), b"abc").unwrap();
    let git = |args: &[&str]| {
        let r = std::process::Command::new("git")
            .arg("-C")
            .arg(&f.source)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .unwrap();
        assert!(r.status.success(), "{}", String::from_utf8_lossy(&r.stderr));
        String::from_utf8(r.stdout).unwrap()
    };
    git(&["init", "-q"]);
    git(&["add", "scripts/proof.mjs"]);
    git(&[
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-q",
        "-m",
        "fixture",
    ]);
    let digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    let mut h = Sha256::new();
    h.update(b"scripts/proof.mjs\0");
    h.update(digest.as_bytes());
    let mut m = json!({"source":{"commit":git(&["rev-parse","HEAD"]).trim(),"sourceSha256":hex(h.finalize()),"sourceFiles":[{"path":"scripts/proof.mjs","sha256":digest}]}});
    verify_source(&f.source, &m, &f.budget()).unwrap();
    m["source"]["commit"] = json!("stale");
    assert!(verify_source(&f.source, &m, &f.budget())
        .unwrap_err()
        .contains("stale"));
    m["source"]["commit"] = json!(git(&["rev-parse", "HEAD"]).trim());
    fs::write(f.source.join("scripts/added.mjs"), b"abc").unwrap();
    assert!(verify_source(&f.source, &m, &f.budget())
        .unwrap_err()
        .contains("set changed"));
    fs::remove_file(f.source.join("scripts/added.mjs")).unwrap();
    fs::write(f.source.join("scripts/proof.mjs"), b"bad").unwrap();
    assert!(verify_source(&f.source, &m, &f.budget())
        .unwrap_err()
        .contains("identity changed"));
}
#[test]
fn actual_tauri_validation_is_not_skipped() {
    let f = Fixture::new();
    fs::write(
        f.source.join("tauri.conf.json"),
        br#"{"identifier":"org.example.fixture","unknownContractField":true}"#,
    )
    .unwrap();
    let saved =
        ["CARGO_CFG_TARGET_OS", "TARGET", "TAURI_CONFIG"].map(|key| (key, env::var_os(key)));
    unsafe {
        env::set_var("CARGO_CFG_TARGET_OS", "linux");
        env::set_var("TARGET", "x86_64-unknown-linux-gnu");
        env::set_var("TAURI_CONFIG", r#"{"bundle":{"resources":{"a":"b"}}}"#);
    }
    let result = with_suppressed(|| {
        tauri_build::try_build(
            tauri_build::Attributes::new().config_path(f.source.join("tauri.conf.json")),
        )
        .map_err(err)
    });
    assert!(result.unwrap_err().contains("unknown field"));
    assert!(env::var("TAURI_CONFIG").unwrap().contains("\"a\":\"b\""));
    unsafe {
        for (key, value) in saved {
            match value {
                Some(v) => env::set_var(key, v),
                None => env::remove_var(key),
            }
        }
    }
}

#[test]
fn atomic_publication_does_not_overwrite_existing_output() {
    let f = Fixture::new();
    let e = f.entry("a");
    let temp = f.target.join("private-temp");
    fs::write(&temp, b"abc").unwrap();
    fs::set_permissions(&temp, fs::Permissions::from_mode(0o640)).unwrap();
    let proof = owned_complete(&f.target, &e, &temp, &f.budget()).unwrap();
    fs::write(f.target.join("a"), b"bad").unwrap();
    assert!(publish_verified(&temp, &f.target.join("a"), &proof).is_err());
    assert_eq!(fs::read(f.target.join("a")).unwrap(), b"bad");
    assert_eq!(fs::read(temp).unwrap(), b"abc");
}

#[test]
fn shared_output_inode_is_not_hinted_or_reused() {
    let f = Fixture::new();
    let e = f.entry("a");
    stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).unwrap();
    let other = f.root.join("other-project-file");
    fs::hard_link(f.target.join("a"), &other).unwrap();
    assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget())
        .unwrap_err()
        .contains("privately owned"));
    assert_eq!(fs::read(other).unwrap(), b"abc");
    assert_eq!(fs::read_dir(&f.evidence).unwrap().count(), 0);
}
#[test]
fn interrupted_copy_preserves_pending_and_resumes_same_target() {
    fn files(root: &Path) -> Vec<PathBuf> {
        let mut stack = vec![root.to_path_buf()];
        let mut result = Vec::new();
        while let Some(dir) = stack.pop() {
            for e in fs::read_dir(dir).unwrap() {
                let p = e.unwrap().path();
                if p.is_dir() {
                    stack.push(p);
                } else {
                    result.push(p);
                }
            }
        }
        result
    }
    let f = Fixture::new();
    let mut e = f.entry("binaries/model.bin");
    let bytes = vec![0x5au8; 2 * 1024 * 1024];
    fs::write(&e.source, &bytes).unwrap();
    e.size = bytes.len() as u64;
    e.sha = hex(Sha256::digest(&bytes));
    let mut first = f.budget();
    first.abort_after_bytes = Some(CHUNK as u64);
    assert!(stage(&[e.clone()], &f.target, &f.evidence, &mut first)
        .unwrap_err()
        .contains("fixture copy interrupted"));
    assert!(
        files(&f.target).is_empty(),
        "interrupted temp leaked into active resources"
    );
    let pending = files(&f.evidence);
    assert_eq!(pending.len(), 1);
    let partial = pending[0].clone();
    assert_eq!(fs::read(&partial).unwrap(), bytes[..CHUNK]);
    let id = identity(&fs::metadata(&partial).unwrap());
    let stats = stage(&[e.clone()], &f.target, &f.evidence, &mut f.budget()).unwrap();
    assert_eq!((stats.copied, stats.reused), (1, 0));
    assert_eq!(fs::read(f.target.join(&e.relative)).unwrap(), bytes);
    assert_eq!(identity(&fs::metadata(&partial).unwrap()), id);
    assert_eq!(fs::read(&partial).unwrap(), bytes[..CHUNK]);
    // A caller-created lookalike in active resources still fails, even with our prefix.
    fs::write(f.target.join("binaries/.krds-stage-untrusted"), b"extra").unwrap();
    assert!(stage(&[e], &f.target, &f.evidence, &mut f.budget())
        .unwrap_err()
        .contains("unexpected output resource"));
    assert_eq!(
        fs::read(f.target.join("binaries/.krds-stage-untrusted")).unwrap(),
        b"extra"
    );
}
#[test]
fn pending_base_cannot_overlap_active_resource_subtree() {
    let f = Fixture::new();
    let e = f.entry("binaries/a");
    let bad = f.target.join("binaries/private-evidence");
    fs::create_dir_all(&bad).unwrap();
    assert!(stage(&[e], &f.target, &bad, &mut f.budget()).is_err());
    assert_eq!(fs::read_dir(&bad).unwrap().count(), 0);
}
