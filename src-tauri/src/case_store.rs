//! Durable local cases. Official output is mandatory; every optional failure is recorded.
use crate::evidence::SessionEvidence;
use crate::validation::{validate_detail_bundle, validate_extra_bundle, validate_sidecar_stdout};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const CASE_SCHEMA: u32 = 1;
// Preserve historical labels; new policy3 output must carry matching metadata.
fn decision_policy(tool_version: &str) -> Option<u32> {
    match tool_version.rsplit_once("-policy") {
        Some((_, "2")) => Some(2),
        Some((_, "3")) => Some(3),
        Some(_) => None,
        None => Some(2),
    }
}
fn json_limit() -> u64 {
    crate::config::number("storage", "officialBytes")
}

pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn is_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        metadata.file_type().is_symlink()
    }
}

pub fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| format!("case write failed: {e}"))?;
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|e| format!("case write failed: {e}"))
}

pub fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| format!("case read failed: {e}"))?;
    if !metadata.is_file() || is_link(&metadata) || metadata.len() > limit {
        return Err("unsafe or oversized case file".into());
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > limit {
        return Err("case file exceeds limit".into());
    }
    Ok(bytes)
}

fn safe_id(id: &str) -> Result<(), String> {
    uuid::Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| "invalid case ID".into())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaseManifest {
    pub schema_version: u32,
    pub case_id: String,
    pub entry_url: String,
    pub started_at: String,
    pub finished_at: String,
    pub exportable_at: String,
    pub status: String,
    pub tool_version: String,
    pub policy_version: u32,
    pub official_sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_sha256: Option<String>,
    pub findings: usize,
    pub issues: Vec<CaseIssue>,
    pub settings: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaseIssue {
    pub code: String,
    pub scope: String,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewRecord {
    pub finding_id: String,
    pub state: String,
    pub judgment: String,
    pub note: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaseReview {
    pub schema_version: u32,
    pub revision: u64,
    pub updated_at: String,
    pub records: Vec<ReviewRecord>,
}
impl Default for CaseReview {
    fn default() -> Self {
        Self {
            schema_version: 1,
            revision: 0,
            updated_at: String::new(),
            records: vec![],
        }
    }
}

pub struct OpenCase {
    pub manifest: CaseManifest,
    pub official: String,
    pub extra: Option<String>,
    pub evidence: Option<SessionEvidence>,
    pub review: CaseReview,
    pub directory: PathBuf,
}

pub struct NewCase<'a> {
    pub id: &'a str,
    pub entry_url: &'a str,
    pub official: &'a str,
    pub detail: Option<&'a str>,
    pub extra: Option<&'a str>,
    pub status: &'a str,
    pub settings: Value,
}

pub struct CaseStore {
    root: PathBuf,
    writes: Mutex<()>,
    _ownership: fs::File,
}

impl Drop for CaseStore {
    fn drop(&mut self) {
        // Unix fork temporarily shares the open file description before exec.
        // Release ownership explicitly rather than waiting for every inherited FD.
        let _ = self._ownership.unlock();
    }
}

impl CaseStore {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&root).map_err(|e| format!("case storage unavailable: {e}"))?;
        if is_link(&fs::symlink_metadata(&root).map_err(|e| e.to_string())?) {
            return Err("case root cannot be a symlink".into());
        }
        let lock_path = root.join(".store.lock");
        if lock_path.exists()
            && is_link(&fs::symlink_metadata(&lock_path).map_err(|e| e.to_string())?)
        {
            return Err("unsafe case ownership file".into());
        }
        let ownership = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(lock_path)
            .map_err(|e| e.to_string())?;
        ownership
            .try_lock()
            .map_err(|e| format!("case storage already owned by another application: {e}"))?;
        // Exclusive ownership proves these are interrupted prior transactions.
        // Preserve every byte in place on the same volume, outside the case namespace.
        for entry in fs::read_dir(&root).map_err(|e| e.to_string())?.take(2000) {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(".pending-") || name.starts_with(".import-") {
                let meta = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
                if !meta.is_dir() || is_link(&meta) {
                    return Err("unsafe interrupted case transaction".into());
                }
                let target = root.join(format!(".quarantine-{}", uuid::Uuid::new_v4()));
                fs::rename(entry.path(), target)
                    .map_err(|e| format!("cannot quarantine interrupted transaction: {e}"))?;
            }
        }
        Ok(Self {
            root,
            writes: Mutex::new(()),
            _ownership: ownership,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn directory(&self, id: &str) -> Result<PathBuf, String> {
        safe_id(id)?;
        let path = self.root.join(id);
        let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if !metadata.is_dir() || is_link(&metadata) {
            return Err("unsafe case directory".into());
        }
        Ok(path)
    }

    /// New run identity only: no overwrite of historical official output.
    pub fn commit(&self, input: NewCase<'_>) -> Result<OpenCase, String> {
        let NewCase {
            id,
            entry_url: entry,
            official,
            detail,
            extra,
            status,
            settings,
        } = input;
        safe_id(id)?;
        if !matches!(status, "succeeded" | "cancelled" | "failed")
            || !crate::warp::valid_settings(&settings, status)
        {
            return Err("invalid case status".into());
        }
        let canonical = validate_sidecar_stdout(entry, official)?;
        let canonical = if status == "failed" {
            official.to_string()
        } else {
            canonical
        };
        if canonical.len() as u64 > json_limit() {
            return Err("official result exceeds case limit".into());
        }
        let parsed: Value = serde_json::from_str(&canonical).map_err(|e| e.to_string())?;
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        let destination = self.root.join(id);
        if destination.exists() {
            return Err("case already committed; original output is immutable".into());
        }
        let staging = self.root.join(format!(".pending-{id}"));
        fs::create_dir(&staging).map_err(|e| format!("case staging failed: {e}"))?;
        // Retain this validated file on subsequent failure; .pending is recoverable evidence.
        write_new(&staging.join("result.json"), canonical.as_bytes())?;
        let mut issues = vec![];
        let valid_extra = extra.filter(|text| validate_extra_bundle(&canonical, text).is_ok());
        if let Some(text) = valid_extra {
            if write_new(&staging.join("result_extra.json"), text.as_bytes()).is_err() {
                issues.push(issue("EXTRA_WRITE_FAILED", "extras"));
            }
        } else {
            issues.push(issue("EXTRA_UNAVAILABLE", "extras"));
        }
        let empty_extra = json!({"meta":parsed["meta"],"findings":[]}).to_string();
        let evidence = detail.and_then(|text| {
            validate_detail_bundle(&canonical, text, valid_extra.unwrap_or(&empty_extra)).ok()?;
            SessionEvidence::from_json(text).ok()
        });
        if let Some(mut index) = evidence {
            if index.persist(&staging).is_err() {
                issues.push(issue("EVIDENCE_WRITE_FAILED", "evidence"));
            }
        } else {
            issues.push(issue("EVIDENCE_UNAVAILABLE", "evidence"));
        }
        let manifest = CaseManifest {
            schema_version: CASE_SCHEMA,
            case_id: id.into(),
            entry_url: entry.into(),
            started_at: parsed["meta"]["started_at"]
                .as_str()
                .unwrap_or_default()
                .into(),
            finished_at: parsed["meta"]["finished_at"]
                .as_str()
                .unwrap_or_default()
                .into(),
            exportable_at: chrono::Utc::now().to_rfc3339(),
            status: status.into(),
            tool_version: parsed["meta"]["tool_version"]
                .as_str()
                .unwrap_or_default()
                .into(),
            policy_version: decision_policy(parsed["meta"]["tool_version"].as_str().unwrap_or_default())
                .ok_or_else(|| "unsupported decision policy".to_string())?,
            official_sha256: digest(canonical.as_bytes()),
            evidence_sha256: read_bounded(&staging.join("evidence.json"), 8_000_000)
                .ok()
                .map(|bytes| digest(&bytes)),
            findings: parsed["findings"].as_array().map_or(0, Vec::len),
            issues,
            settings,
        };
        write_new(
            &staging.join("manifest.json"),
            &serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
        )?;
        fs::rename(&staging, &destination).map_err(|e| {
            format!(
                "case commit failed; validated output retained at {}: {e}",
                staging.display()
            )
        })?;
        drop(_guard);
        self.open(id)
    }

    pub fn open(&self, id: &str) -> Result<OpenCase, String> {
        let directory = self.directory(id)?;
        let mut manifest: CaseManifest =
            serde_json::from_slice(&read_bounded(&directory.join("manifest.json"), 1_000_000)?)
                .map_err(|e| e.to_string())?;
        if manifest.schema_version != CASE_SCHEMA
            || manifest.case_id != id
            || !matches!(
                manifest.status.as_str(),
                "succeeded" | "cancelled" | "failed"
            )
        {
            return Err("unsupported or mismatched case schema/identity".into());
        }
        let bytes = read_bounded(&directory.join("result.json"), json_limit())?;
        if digest(&bytes) != manifest.official_sha256 {
            return Err("official result integrity mismatch".into());
        }
        let official = String::from_utf8(bytes).map_err(|e| e.to_string())?;
        validate_sidecar_stdout(&manifest.entry_url, &official)?;
        validate_manifest(&manifest, &official)?;
        let extra = read_bounded(&directory.join("result_extra.json"), json_limit())
            .ok()
            .and_then(|b| String::from_utf8(b).ok())
            .filter(|text| validate_extra_bundle(&official, text).is_ok());
        let evidence = manifest
            .evidence_sha256
            .as_ref()
            .and_then(|hash| {
                read_bounded(&directory.join("evidence.json"), 8_000_000)
                    .ok()
                    .filter(|bytes| digest(bytes) == *hash)
            })
            .and_then(|_| SessionEvidence::reopen(&directory, &official, extra.as_deref()).ok());
        if extra.is_none() && !manifest.issues.iter().any(|i| i.scope == "extras") {
            manifest.issues.push(issue("EXTRA_UNAVAILABLE", "extras"));
        }
        if evidence.is_none() && !manifest.issues.iter().any(|i| i.scope == "evidence") {
            manifest
                .issues
                .push(issue("EVIDENCE_UNAVAILABLE", "evidence"));
        }
        let review = if directory.join("review.json").exists() {
            let value = read_bounded(&directory.join("review.json"), 4_000_000)
                .ok()
                .and_then(|b| serde_json::from_slice::<CaseReview>(&b).ok())
                .filter(|r| valid_review(r, &official));
            match value {
                Some(value) => value,
                None => {
                    manifest.issues.push(issue("REVIEW_UNAVAILABLE", "review"));
                    CaseReview::default()
                }
            }
        } else {
            CaseReview::default()
        };
        Ok(OpenCase {
            manifest,
            official,
            extra,
            evidence,
            review,
            directory,
        })
    }

    /// Host cancellation changes case status, never the immutable worker output.
    pub fn mark_cancelled(&self, id: &str) -> Result<OpenCase, String> {
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        let mut case = self.open(id)?;
        if !crate::warp::valid_settings(&case.manifest.settings, "cancelled") {
            return Err("incomplete transport case must remain failed".into());
        }
        case.manifest.status = "cancelled".into();
        atomic_replace(
            &case.directory.join("manifest.json"),
            &serde_json::to_vec_pretty(&case.manifest).map_err(|e| e.to_string())?,
        )?;
        Ok(case)
    }

    pub fn list(&self) -> Result<Value, String> {
        let mut cases = vec![];
        let mut issues = vec![];
        for (index, entry) in fs::read_dir(&self.root)
            .map_err(|e| e.to_string())?
            .take(2001)
            .enumerate()
        {
            if index == 2000 {
                issues.push(json!({"code":"CASE_LIST_LIMIT","caseId":"","retryable":false}));
                break;
            }
            let entry = entry.map_err(|e| e.to_string())?;
            let id = entry.file_name().to_string_lossy().into_owned();
            if id.starts_with(".pending-") {
                issues.push(json!({"code":"INCOMPLETE_TRANSACTION","caseId":id,"retryable":false}));
                continue;
            }
            if id.starts_with(".quarantine-") {
                issues
                    .push(json!({"code":"QUARANTINED_TRANSACTION","caseId":id,"retryable":false}));
                continue;
            }
            if safe_id(&id).is_err() {
                continue;
            }
            let directory = match self.directory(&id) {
                Ok(path) => path,
                Err(_) => {
                    issues.push(json!({"code":"CASE_UNAVAILABLE","caseId":id,"retryable":false}));
                    continue;
                }
            };
            let manifest = read_bounded(&directory.join("manifest.json"), 256_000)
                .ok()
                .and_then(|b| serde_json::from_slice::<CaseManifest>(&b).ok())
                .filter(|m| manifest_metadata_valid(m) && m.case_id == id);
            match manifest {
                Some(manifest) => cases.push(json!({"manifest":manifest,"directory":directory})),
                None => {
                    issues.push(json!({"code":"CASE_UNAVAILABLE","caseId":id,"retryable":false}))
                }
            }
        }
        cases.sort_by(|a, b| {
            b["manifest"]["finishedAt"]
                .as_str()
                .cmp(&a["manifest"]["finishedAt"].as_str())
        });
        Ok(
            json!({"schemaVersion":1,"storageRoot":self.root,"cases":cases,"issues":issues,"limit":2000}),
        )
    }

    pub fn save_review(
        &self,
        id: &str,
        expected: u64,
        records: Vec<ReviewRecord>,
    ) -> Result<CaseReview, String> {
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        let case = self.open(id)?;
        if case
            .manifest
            .issues
            .iter()
            .any(|issue| issue.scope == "review")
        {
            return Err(
                "REVIEW_UNAVAILABLE: preserve and restore review.json before editing".into(),
            );
        }
        if case.review.revision != expected {
            return Err(format!(
                "REVIEW_CONFLICT: current revision {}",
                case.review.revision
            ));
        }
        let parsed: Value = serde_json::from_str(&case.official).map_err(|e| e.to_string())?;
        let ids: std::collections::HashSet<&str> = parsed["findings"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|f| f["id"].as_str())
            .collect();
        let mut seen = std::collections::HashSet::new();
        if records.len() > ids.len()
            || records.iter().any(|r| {
                !ids.contains(r.finding_id.as_str())
                    || !seen.insert(&r.finding_id)
                    || !matches!(r.state.as_str(), "needed" | "reviewed")
                    || !matches!(
                        r.judgment.as_str(),
                        "unjudged" | "suspected" | "judged-normal" | "needs-more-evidence"
                    )
                    || r.note.chars().count() > 2000
                    || chrono::DateTime::parse_from_rfc3339(&r.at).is_err()
            })
        {
            return Err("invalid review records".into());
        }
        if expected >= 9_007_199_254_740_991 {
            return Err("review revision exhausted".into());
        }
        let review = CaseReview {
            schema_version: 1,
            revision: expected + 1,
            updated_at: chrono::Utc::now().to_rfc3339(),
            records,
        };
        let path = case.directory.join("review.json");
        atomic_replace(
            &path,
            &serde_json::to_vec_pretty(&review).map_err(|e| e.to_string())?,
        )?;
        Ok(review)
    }

    /// Equivalent portable directory transfer: allowlist files, no symlinks or executables.
    pub fn export_directory(&self, id: &str, destination: &Path) -> Result<PathBuf, String> {
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        let case = self.open(id)?;
        let destination = fs::canonicalize(destination).map_err(|e| e.to_string())?;
        if destination.starts_with(fs::canonicalize(&case.directory).map_err(|e| e.to_string())?) {
            return Err("export destination must be outside the case".into());
        }
        let target = destination.join(format!("case-{id}"));
        if target.exists() {
            return Err("case export destination exists".into());
        }
        let staging = destination.join(format!(".export-{}", uuid::Uuid::new_v4()));
        let copied = copy_portable(&case.directory, &staging)
            .and_then(|()| fs::rename(&staging, &target).map_err(|e| e.to_string()));
        if let Err(error) = copied {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
        Ok(target)
    }

    pub fn import_directory(&self, source: &Path) -> Result<String, String> {
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        let manifest: CaseManifest =
            serde_json::from_slice(&read_bounded(&source.join("manifest.json"), 1_000_000)?)
                .map_err(|e| e.to_string())?;
        safe_id(&manifest.case_id)?;
        if manifest.schema_version != CASE_SCHEMA {
            return Err("unsupported case schema".into());
        }
        if self.root.join(&manifest.case_id).exists() {
            return Err("case identity already exists".into());
        }
        let staging = self.root.join(format!(".import-{}", uuid::Uuid::new_v4()));
        let imported = (|| -> Result<(), String> {
            copy_portable(source, &staging)?;
            // Validate before exposing the imported identity. Optional records may degrade;
            // unsupported schemas cannot be silently interpreted as an empty review.
            let check_root = staging.parent().ok_or("invalid staging")?;
            let bytes = read_bounded(&staging.join("result.json"), json_limit())?;
            if digest(&bytes) != manifest.official_sha256 {
                return Err("import official integrity mismatch".into());
            }
            validate_sidecar_stdout(
                &manifest.entry_url,
                std::str::from_utf8(&bytes).map_err(|e| e.to_string())?,
            )?;
            validate_manifest(
                &manifest,
                std::str::from_utf8(&bytes).map_err(|e| e.to_string())?,
            )?;
            if staging.join("review.json").exists() {
                let review: CaseReview =
                    serde_json::from_slice(&read_bounded(&staging.join("review.json"), 4_000_000)?)
                        .map_err(|e| e.to_string())?;
                if !valid_review(
                    &review,
                    std::str::from_utf8(&bytes).map_err(|e| e.to_string())?,
                ) {
                    return Err("unsupported or invalid imported review schema/records".into());
                }
            }
            let destination = check_root.join(&manifest.case_id);
            if destination.exists() {
                return Err("case identity already exists".into());
            }
            fs::rename(&staging, destination).map_err(|e| e.to_string())?;
            Ok(())
        })();
        if let Err(error) = imported {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
        Ok(manifest.case_id)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        let directory = self.directory(id)?;
        // Refuse a tampered tree instead of following directory reparse/symlink entries.
        reject_links(&directory, 0)?;
        fs::remove_dir_all(directory).map_err(|e| e.to_string())
    }

    /// Batch groups live beside case directories in a reserved, non-UUID folder,
    /// so `list()` ignores them and no case manifest or result format changes.
    fn groups_root(&self) -> Result<PathBuf, String> {
        let path = self.root.join("groups");
        if !path.exists() {
            fs::create_dir(&path).map_err(|e| format!("case storage unavailable: {e}"))?;
        }
        let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if !metadata.is_dir() || is_link(&metadata) {
            return Err("unsafe batch group storage".into());
        }
        Ok(path)
    }

    /// Upsert one group. Identity is the validated group id, so rewriting a
    /// group never touches a case directory or a review revision.
    pub fn save_group(&self, group: &BatchGroup) -> Result<Value, String> {
        let _guard = self.writes.lock().map_err(|_| "case lock poisoned")?;
        if !valid_group(group) {
            return Err("invalid batch group".into());
        }
        let root = self.groups_root()?;
        let bytes = serde_json::to_vec_pretty(group).map_err(|e| e.to_string())?;
        if bytes.len() as u64 > BATCH_GROUP_BYTES {
            return Err("batch group exceeds limit".into());
        }
        safe_id(&group.group_id)?;
        atomic_replace(&root.join(format!("{}.json", group.group_id)), &bytes)?;
        serde_json::to_value(group).map_err(|e| e.to_string())
    }

    /// One malformed group is reported as an issue; it never hides the others.
    pub fn list_groups(&self) -> Result<Value, String> {
        let root = self.root.join("groups");
        let mut groups = vec![];
        let mut issues = vec![];
        if root.exists() {
            let metadata = fs::symlink_metadata(&root).map_err(|e| e.to_string())?;
            if !metadata.is_dir() || is_link(&metadata) {
                return Err("unsafe batch group storage".into());
            }
            for (index, entry) in fs::read_dir(&root)
                .map_err(|e| e.to_string())?
                .take(BATCH_GROUP_LIST_LIMIT as usize + 1)
                .enumerate()
            {
                if index == BATCH_GROUP_LIST_LIMIT as usize {
                    issues.push(json!({"code":"BATCH_GROUP_LIST_LIMIT","groupId":""}));
                    break;
                }
                let entry = entry.map_err(|e| e.to_string())?;
                let name = entry.file_name().to_string_lossy().into_owned();
                let Some(id) = name.strip_suffix(".json") else {
                    continue;
                };
                if safe_id(id).is_err() {
                    continue;
                }
                let group = read_bounded(&entry.path(), BATCH_GROUP_BYTES)
                    .ok()
                    .and_then(|bytes| serde_json::from_slice::<BatchGroup>(&bytes).ok())
                    .filter(|group| valid_group(group) && group.group_id == id);
                match group {
                    Some(group) => {
                        groups.push(serde_json::to_value(group).map_err(|e| e.to_string())?)
                    }
                    None => issues.push(json!({"code":"BATCH_GROUP_UNAVAILABLE","groupId":id})),
                }
            }
        }
        groups.sort_by(|a, b| {
            b["updatedAt"]
                .as_str()
                .cmp(&a["updatedAt"].as_str())
                .then_with(|| b["groupId"].as_str().cmp(&a["groupId"].as_str()))
        });
        Ok(json!({"schemaVersion":1,"groups":groups,"issues":issues}))
    }
}

pub const BATCH_GROUP_SCHEMA: u32 = 1;
pub const BATCH_GROUP_LIST_LIMIT: u32 = 200;
const BATCH_GROUP_BYTES: u64 = 256_000;
const BATCH_GROUP_TARGET_LIMIT: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BatchGroupTarget {
    pub key: u32,
    pub label: String,
    pub entry_url: String,
    pub kind: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub case_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Restart-recovery identity for one operator batch: order, per-target case
/// binding and status. Official output and review records stay in the case.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BatchGroup {
    pub schema_version: u32,
    pub group_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub phase: String,
    pub scope: String,
    pub connection: String,
    pub targets: Vec<BatchGroupTarget>,
}

fn bounded_text(value: &str, limit: usize) -> bool {
    value.encode_utf16().count() <= limit && !value.contains('\0')
}

fn public_entry_url(url: &str) -> bool {
    bounded_text(url, 8192)
        && !url.is_empty()
        && !url.chars().any(char::is_whitespace)
        && url.split_once("://").is_some_and(|(scheme, rest)| {
            let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
            (scheme.eq_ignore_ascii_case("http") || scheme.eq_ignore_ascii_case("https"))
                && !authority.is_empty()
                && !authority.contains('@')
        })
}

fn valid_group(group: &BatchGroup) -> bool {
    group.schema_version == BATCH_GROUP_SCHEMA
        && safe_id(&group.group_id).is_ok()
        && chrono::DateTime::parse_from_rfc3339(&group.created_at).is_ok()
        && chrono::DateTime::parse_from_rfc3339(&group.updated_at).is_ok()
        && matches!(
            group.phase.as_str(),
            "ready" | "running" | "paused" | "stopped" | "complete"
        )
        && matches!(group.scope.as_str(), "entry" | "quick" | "automatic")
        && matches!(group.connection.as_str(), "direct" | "warp")
        && !group.targets.is_empty()
        && group.targets.len() <= BATCH_GROUP_TARGET_LIMIT
        && group.targets.iter().enumerate().all(|(index, target)| {
            target.key as usize == index
                && bounded_text(&target.label, 512)
                && public_entry_url(&target.entry_url)
                && matches!(target.kind.as_str(), "site" | "sitemap")
                && matches!(
                    target.status.as_str(),
                    "pending"
                        | "running"
                        | "complete"
                        | "partial"
                        | "blocked"
                        | "failed"
                        | "cancelled"
                )
                && target
                    .case_id
                    .as_deref()
                    .is_none_or(|id| safe_id(id).is_ok())
                && target
                    .error
                    .as_deref()
                    .is_none_or(|error| bounded_text(error, 2000))
        })
}

fn issue(code: &str, scope: &str) -> CaseIssue {
    CaseIssue {
        code: code.into(),
        scope: scope.into(),
        retryable: false,
    }
}

fn manifest_metadata_valid(manifest: &CaseManifest) -> bool {
    let bounded = |s: &str, limit: usize| !s.is_empty() && s.encode_utf16().count() <= limit;
    let hash = |s: &str| {
        s.len() == 64
            && s.bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    };
    let timestamp = |s: &str| chrono::DateTime::parse_from_rfc3339(s).is_ok();
    manifest.schema_version == CASE_SCHEMA
        && safe_id(&manifest.case_id).is_ok()
        && public_entry_url(&manifest.entry_url)
        && timestamp(&manifest.started_at)
        && timestamp(&manifest.finished_at)
        && timestamp(&manifest.exportable_at)
        && matches!(
            manifest.status.as_str(),
            "succeeded" | "cancelled" | "failed"
        )
        && bounded(&manifest.tool_version, 128)
        && Some(manifest.policy_version) == decision_policy(&manifest.tool_version)
        && hash(&manifest.official_sha256)
        && manifest.evidence_sha256.as_deref().is_none_or(hash)
        && manifest.findings <= 20_000
        && crate::warp::valid_settings(&manifest.settings, &manifest.status)
        && manifest.issues.len() <= 1000
        && manifest
            .issues
            .iter()
            .all(|i| bounded(&i.code, 128) && bounded(&i.scope, 64))
}

fn validate_manifest(manifest: &CaseManifest, official: &str) -> Result<(), String> {
    let parsed: Value = serde_json::from_str(official).map_err(|e| e.to_string())?;
    if !manifest_metadata_valid(manifest)
        || manifest.findings != parsed["findings"].as_array().map_or(0, Vec::len)
        || manifest.started_at != parsed["meta"]["started_at"]
        || manifest.finished_at != parsed["meta"]["finished_at"]
        || manifest.tool_version != parsed["meta"]["tool_version"]
        || Some(manifest.policy_version) != decision_policy(&manifest.tool_version)
        || chrono::DateTime::parse_from_rfc3339(&manifest.exportable_at).is_err()
    {
        return Err("case manifest disagrees with official output or policy".into());
    }
    Ok(())
}

fn valid_review(review: &CaseReview, official: &str) -> bool {
    let Ok(parsed) = serde_json::from_str::<Value>(official) else {
        return false;
    };
    let ids: std::collections::HashSet<&str> = parsed["findings"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|f| f["id"].as_str())
        .collect();
    let mut seen = std::collections::HashSet::new();
    review.schema_version == 1
        && review.revision <= 9_007_199_254_740_991
        && (chrono::DateTime::parse_from_rfc3339(&review.updated_at).is_ok()
            || review.revision == 0 && review.records.is_empty() && review.updated_at.is_empty())
        && review.records.len() <= ids.len()
        && review.records.iter().all(|r| {
            ids.contains(r.finding_id.as_str())
                && seen.insert(r.finding_id.as_str())
                && matches!(r.state.as_str(), "needed" | "reviewed")
                && matches!(
                    r.judgment.as_str(),
                    "unjudged" | "suspected" | "judged-normal" | "needs-more-evidence"
                )
                && r.note.chars().count() <= 2000
                && chrono::DateTime::parse_from_rfc3339(&r.at).is_ok()
        })
}

fn reject_links(path: &Path, depth: usize) -> Result<(), String> {
    if depth > 2 {
        return Err("unsafe case tree depth".into());
    }
    for (index, entry) in fs::read_dir(path).map_err(|e| e.to_string())?.enumerate() {
        if index > 1024 {
            return Err("unsafe case tree size".into());
        }
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        if is_link(&meta) {
            return Err("unsafe case tree; deletion refused".into());
        }
        if meta.is_dir() {
            reject_links(&entry.path(), depth + 1)?;
        }
    }
    Ok(())
}

pub fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    write_new(&temp, bytes)?;
    #[cfg(windows)]
    {
        // MoveFileExW provides same-volume replacement without deleting the prior revision.
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
        }
        let from: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        // SAFETY: both buffers are NUL-terminated and live through this synchronous call.
        if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), 0x1 | 0x8) } == 0 {
            let _ = fs::remove_file(temp);
            return Err(format!(
                "case replacement failed: {}",
                std::io::Error::last_os_error()
            ));
        }
    }
    #[cfg(not(windows))]
    if let Err(error) = fs::rename(&temp, path) {
        let _ = fs::remove_file(temp);
        return Err(format!("case replacement failed: {error}"));
    }
    Ok(())
}

fn copy_portable(source: &Path, target: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source).map_err(|e| e.to_string())?;
    if !metadata.is_dir() || is_link(&metadata) {
        return Err("unsafe portable directory".into());
    }
    fs::create_dir(target).map_err(|e| e.to_string())?;
    let mut total = 0u64;
    let mut count = 0;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let text = name.to_str().ok_or("invalid portable filename")?;
        let meta = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        if is_link(&meta) {
            return Err("portable symlinks forbidden".into());
        }
        if text == "assets" && meta.is_dir() {
            fs::create_dir(target.join("assets")).map_err(|e| e.to_string())?;
            for asset in fs::read_dir(entry.path()).map_err(|e| e.to_string())? {
                let asset = asset.map_err(|e| e.to_string())?;
                let hash = asset.file_name().to_string_lossy().into_owned();
                if hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
                    return Err("invalid portable asset name".into());
                }
                let bytes = read_bounded(&asset.path(), 525_000)?;
                if !crate::evidence::is_image_bytes(&bytes) {
                    return Err("portable asset is not a supported image".into());
                }
                total += bytes.len() as u64;
                count += 1;
                if count > 512 || total > 64_000_000 || digest(&bytes) != hash {
                    return Err("portable asset integrity/size limit".into());
                }
                write_new(&target.join("assets").join(hash), &bytes)?;
            }
        } else {
            if !matches!(
                text,
                "manifest.json"
                    | "result.json"
                    | "result_extra.json"
                    | "evidence.json"
                    | "review.json"
            ) {
                return Err("unsupported portable file".into());
            }
            let bytes = read_bounded(&entry.path(), json_limit())?;
            total += bytes.len() as u64;
            count += 1;
            if count > 517 || total > 64_000_000 {
                return Err("portable case limit".into());
            }
            write_new(&target.join(name), &bytes)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Temporary(PathBuf);
    impl Temporary {
        fn new() -> Self {
            let p = std::env::temp_dir().join(format!("krds-case-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&p).unwrap();
            Self(p)
        }
    }
    impl Drop for Temporary {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn official() -> String {
        json!({"meta":{"topic":"TOPIC","entry_url":"https://example.kr/","started_at":"2026-10-09T00:00:00Z","finished_at":"2026-10-09T00:00:01Z","elapsed_sec":1,"tool_version":"0.2.0-policy2"},"findings":[{"id":"f1","url":"https://example.kr/","location":"#ad","evidence_text":"ＣＡＳＩＮＯ 가입","is_violation":true,"technique":"HOMOGLYPH"}]}).to_string()
    }

    #[test]
    fn shares_official_contract_boundary_cases_with_typescript() {
        let corpus: Value = serde_json::from_str(include_str!(
            "../../packages/contracts/test/fixtures/official-conformance.json"
        ))
        .unwrap();
        assert!(
            validate_sidecar_stdout("https://example.kr/", &corpus["valid"].to_string()).is_ok()
        );
        for sample in corpus["invalid"].as_array().unwrap() {
            let mut value = corpus["valid"].clone();
            let path = sample["path"].as_array().unwrap();
            let mut target = &mut value;
            for key in &path[..path.len() - 1] {
                target = if let Some(i) = key.as_u64() {
                    &mut target[i as usize]
                } else {
                    &mut target[key.as_str().unwrap()]
                };
            }
            let last = path.last().unwrap();
            if let Some(i) = last.as_u64() {
                target[i as usize] = sample["value"].clone();
            } else {
                target[last.as_str().unwrap()] = sample["value"].clone();
            }
            assert!(
                validate_sidecar_stdout("https://example.kr/", &value.to_string()).is_err(),
                "{}",
                sample["name"]
            );
        }
    }

    #[test]
    fn decision_policy_labels_preserve_history_and_reject_future_versions() {
        assert_eq!(decision_policy("0.2.0-policy2"), Some(2));
        assert_eq!(decision_policy("0.2.1-policy3"), Some(3));
        assert_eq!(decision_policy("legacy"), Some(2));
        assert_eq!(decision_policy("0.2.1-policy4"), None);
    }

    #[test]
    fn missing_or_null_policy_fields_are_rejected_for_all_policy_labels() {
        let corpus: Value = serde_json::from_str(include_str!(
            "../../packages/contracts/test/fixtures/case-conformance.json"
        )).unwrap();
        for tool in ["0.2.1-policy2", "0.2.1-policy3", "0.2.1-policy4"] {
            for missing in [true, false] {
                let mut manifest = corpus["valid"]["manifest"].clone();
                manifest["toolVersion"] = json!(tool);
                if missing {
                    manifest.as_object_mut().unwrap().remove("policyVersion");
                } else {
                    manifest["policyVersion"] = Value::Null;
                }
                assert!(serde_json::from_value::<CaseManifest>(manifest).is_err());
            }
        }
    }

    #[tokio::test]
    async fn restart_keeps_official_and_review_while_optional_files_are_missing_or_corrupt() {
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let registry = crate::session::SessionRegistry::persistent(root.clone()).unwrap();
        let record = crate::session::new_session(
            "https://example.kr/".into(),
            "2026-10-09T00:00:00Z".into(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        assert!(
            registry
                .store_result(
                    &id,
                    official(),
                    "{broken".into(),
                    "{broken".into(),
                    "2026-10-09T00:00:01Z".into()
                )
                .await
        );
        let original = fs::read(root.join(&id).join("result.json")).unwrap();
        let records = vec![ReviewRecord {
            finding_id: "f1".into(),
            state: "reviewed".into(),
            judgment: "needs-more-evidence".into(),
            note: "담당자에게 원본 확인 요청".into(),
            at: "2026-10-09T00:02:00Z".into(),
        }];
        assert_eq!(
            registry
                .case_store()
                .unwrap()
                .save_review(&id, 0, records.clone())
                .unwrap()
                .revision,
            1
        );
        assert!(registry
            .case_store()
            .unwrap()
            .save_review(&id, 0, records)
            .unwrap_err()
            .starts_with("REVIEW_CONFLICT"));
        drop(registry);
        fs::write(root.join(&id).join("evidence.json"), "{broken").unwrap();
        let restarted = crate::session::SessionRegistry::persistent(root.clone()).unwrap();
        let reopened = restarted.open_case(&id).await.unwrap();
        assert_eq!(
            reopened["review"]["records"][0]["note"],
            "담당자에게 원본 확인 요청"
        );
        assert_eq!(
            reopened["review"]["records"][0]["judgment"],
            "needs-more-evidence"
        );
        assert_eq!(reopened["manifest"]["issues"].as_array().unwrap().len(), 2);
        assert_eq!(
            restarted
                .validated_export_text(&id)
                .await
                .unwrap()
                .as_bytes(),
            original
        );
        assert!(restarted.finding_detail_value(&id, "f1").await.is_none());
    }

    #[test]
    fn rejects_invalid_official_and_retains_valid_staging_on_commit_failure() {
        let temp = Temporary::new();
        let store = CaseStore::new(temp.0.join("cases")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        assert!(store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: "{}",
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({})
            })
            .is_err());
        assert!(!store.root.join(&id).exists());
        fs::create_dir(store.root.join(format!(".pending-{id}"))).unwrap();
        assert!(store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({})
            })
            .is_err());
        assert_eq!(
            store.list().unwrap()["issues"][0]["code"],
            "INCOMPLETE_TRANSACTION"
        );
    }

    #[test]
    fn warp_incomplete_commit_requires_failed_status() {
        let temp = Temporary::new();
        let store = CaseStore::new(temp.0.join("cases")).unwrap();
        for status in ["succeeded", "cancelled"] {
            let id = uuid::Uuid::new_v4().to_string();
            assert!(store.commit(NewCase { id: &id, entry_url: "https://example.kr/", official: &official(), detail: None, extra: None, status,
                settings: json!({"transportFailure":{"code":"tunnel-exited","scope":"incomplete"}}) }).is_err());
            assert!(!store.root.join(&id).exists());
        }
    }

    #[test]
    fn warp_incomplete_manifest_cannot_reopen_or_import_as_complete() {
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let destination = CaseStore::new(temp.0.join("destination")).unwrap();
        for status in ["succeeded", "cancelled"] {
            let id = uuid::Uuid::new_v4().to_string();
            source.commit(NewCase { id: &id, entry_url: "https://example.kr/", official: &official(), detail: None, extra: None, status: "failed",
                settings: json!({"transportFailure":{"code":"tunnel-exited","scope":"incomplete"}}) }).unwrap();
            let output = temp.0.join(format!("portable-{status}"));
            fs::create_dir(&output).unwrap();
            let portable = source.export_directory(&id, &output).unwrap();
            for directory in [source.root.join(&id), portable.clone()] {
                let path = directory.join("manifest.json");
                let mut manifest: Value =
                    serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
                manifest["status"] = json!(status);
                fs::write(path, serde_json::to_vec(&manifest).unwrap()).unwrap();
            }
            let reopened = source.open(&id);
            let imported = destination.import_directory(&portable);
            assert_eq!((reopened.is_err(), imported.is_err()), (true, true));
            assert!(!destination.root.join(&id).exists());
        }
    }

    #[tokio::test]
    async fn warp_direct_and_historical_cases_round_trip_without_failure_metadata() {
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let store = CaseStore::new(root.clone()).unwrap();
        let original = validate_sidecar_stdout("https://example.kr/", &official()).unwrap();
        let cases = [
            (
                "succeeded",
                json!({"connection":"direct","transport":{"kind":"direct","reason":"operator"}}),
            ),
            (
                "succeeded",
                json!({"connection":"warp","transport":{"kind":"warp","backend":"usque","version":"4.2.1"}}),
            ),
            (
                "succeeded",
                json!({"connection":"warp","transport":{"kind":"direct","reason":"owned-origin"}}),
            ),
            (
                "succeeded",
                json!({"transport":{"kind":"direct","reason":"owned-origin"}}),
            ),
            (
                "succeeded",
                json!({"transport":{"kind":"direct","reason":"source-cli"}}),
            ),
            ("succeeded", json!({})),
            ("cancelled", json!({})),
            ("failed", json!({})),
        ];
        let mut identities = Vec::new();
        for (status, settings) in &cases {
            let id = uuid::Uuid::new_v4().to_string();
            store
                .commit(NewCase {
                    id: &id,
                    entry_url: "https://example.kr/",
                    official: &original,
                    detail: None,
                    extra: None,
                    status,
                    settings: settings.clone(),
                })
                .unwrap();
            identities.push(id);
        }
        drop(store);
        let restarted = crate::session::SessionRegistry::persistent(root.clone()).unwrap();
        for (id, (status, settings)) in identities.iter().zip(cases.iter()) {
            let opened = restarted.open_case(id).await.unwrap();
            assert_eq!(opened["manifest"]["status"], *status);
            assert_eq!(opened["manifest"]["settings"], *settings);
            assert!(opened["manifest"]["settings"]
                .get("transportFailure")
                .is_none());
            assert_eq!(restarted.snapshot(id).await.unwrap()["status"], *status);
            assert_eq!(
                fs::read(root.join(id).join("result.json")).unwrap(),
                original.as_bytes()
            );
            assert_eq!(restarted.validated_export_text(id).await.unwrap(), original);
        }
    }

    #[test]
    fn warp_incomplete_case_cannot_be_rewritten_as_cancelled() {
        let temp = Temporary::new();
        let store = CaseStore::new(temp.0.join("cases")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "failed",
                settings: json!({"transportFailure":{"code":"tunnel-exited","scope":"incomplete"}}),
            })
            .unwrap();
        store.save_review(&id, 0, vec![]).unwrap();
        let files = ["manifest.json", "result.json", "review.json"];
        let before: Vec<_> = files
            .iter()
            .map(|name| fs::read(store.root.join(&id).join(name)).unwrap())
            .collect();
        assert!(store.mark_cancelled(&id).is_err());
        assert_eq!(store.open(&id).unwrap().manifest.status, "failed");
        for (name, bytes) in files.iter().zip(before) {
            assert_eq!(fs::read(store.root.join(&id).join(name)).unwrap(), bytes);
        }
        let ordinary = uuid::Uuid::new_v4().to_string();
        store
            .commit(NewCase {
                id: &ordinary,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        assert_eq!(
            store.mark_cancelled(&ordinary).unwrap().manifest.status,
            "cancelled"
        );
        assert_eq!(store.open(&ordinary).unwrap().manifest.status, "cancelled");
    }

    #[test]
    fn portable_transfer_preserves_original_and_rejects_tampering_and_executables() {
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let target = CaseStore::new(temp.0.join("target")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let case = source
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let output = temp.0.join("transfer");
        fs::create_dir(&output).unwrap();
        let portable = source.export_directory(&id, &output).unwrap();
        assert_eq!(target.import_directory(&portable).unwrap(), id);
        assert_eq!(target.open(&id).unwrap().official, case.official);
        fs::write(portable.join("run.exe"), b"MZ").unwrap();
        let third = CaseStore::new(temp.0.join("third")).unwrap();
        assert!(third
            .import_directory(&portable)
            .unwrap_err()
            .contains("unsupported portable file"));
        fs::remove_file(portable.join("run.exe")).unwrap();
        fs::write(portable.join("result.json"), b"{}").unwrap();
        assert!(third
            .import_directory(&portable)
            .unwrap_err()
            .contains("integrity mismatch"));
        fs::write(source.root.join(&id).join("result.json"), "{}").unwrap();
        assert!(source
            .open(&id)
            .err()
            .unwrap()
            .contains("integrity mismatch"));
    }

    #[test]
    fn one_malformed_manifest_does_not_hide_other_saved_cases() {
        let temporary = Temporary::new();
        let store = CaseStore::new(temporary.0.join("cases")).unwrap();
        let healthy = uuid::Uuid::new_v4().to_string();
        let corrupt = uuid::Uuid::new_v4().to_string();
        for id in [&healthy, &corrupt] {
            store
                .commit(NewCase {
                    id,
                    entry_url: "https://example.kr/",
                    official: &official(),
                    detail: None,
                    extra: None,
                    status: "succeeded",
                    settings: json!({}),
                })
                .unwrap();
        }
        let path = store.root().join(&corrupt).join("manifest.json");
        let mut manifest: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        manifest["settings"] = json!([]);
        fs::write(path, manifest.to_string()).unwrap();
        let listed = store.list().unwrap();
        assert_eq!(listed["cases"].as_array().unwrap().len(), 1);
        assert_eq!(listed["cases"][0]["manifest"]["caseId"], healthy);
        assert_eq!(listed["issues"][0]["caseId"], corrupt);
        assert_eq!(listed["issues"][0]["code"], "CASE_UNAVAILABLE");
    }

    #[cfg(unix)]
    #[test]
    fn portable_transfer_rejects_symlink_escape() {
        use std::os::unix::fs::symlink;
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let target = CaseStore::new(temp.0.join("target")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        source
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        symlink(temp.0.join("source"), source.root.join(&id).join("assets")).unwrap();
        assert!(target
            .import_directory(&source.root.join(&id))
            .unwrap_err()
            .contains("symlinks forbidden"));
        assert!(source.open("../source").is_err());
    }

    fn review_record() -> ReviewRecord {
        ReviewRecord {
            finding_id: "f1".into(),
            state: "reviewed".into(),
            judgment: "suspected".into(),
            note: "Preserve this memo".into(),
            at: "2026-10-09T00:02:00Z".into(),
        }
    }

    #[test]
    fn malformed_or_future_reviews_are_preserved_and_cannot_be_silently_overwritten() {
        let temp = Temporary::new();
        let store = CaseStore::new(temp.0.join("cases")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let case = store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let good = json!({"schemaVersion":1,"revision":1,"updatedAt":"2026-10-09T00:02:00Z","records":[review_record()]});
        let mut variants = vec![
            json!({"schemaVersion":2,"revision":1,"updatedAt":"2026-10-09T00:02:00Z","records":[]}),
        ];
        for (key, value) in [
            ("findingId", json!("missing")),
            ("state", json!("unknown")),
            ("judgment", json!("illegal")),
            ("at", json!("tomorrow")),
            ("note", json!("x".repeat(2001))),
        ] {
            let mut invalid = good.clone();
            invalid["records"][0][key] = value;
            variants.push(invalid);
        }
        let mut duplicate = good.clone();
        duplicate["records"]
            .as_array_mut()
            .unwrap()
            .push(json!(review_record()));
        variants.push(duplicate);
        let mut unsafe_revision = good.clone();
        unsafe_revision["revision"] = json!(9_007_199_254_740_992u64);
        variants.push(unsafe_revision);
        let mut bad_time = good.clone();
        bad_time["updatedAt"] = json!("tomorrow");
        variants.push(bad_time);
        for invalid in variants {
            let bytes = serde_json::to_vec(&invalid).unwrap();
            fs::write(case.directory.join("review.json"), &bytes).unwrap();
            let opened = store.open(&id).unwrap();
            assert!(
                opened
                    .manifest
                    .issues
                    .iter()
                    .any(|issue| issue.code == "REVIEW_UNAVAILABLE"),
                "accepted {invalid}"
            );
            assert!(store
                .save_review(&id, 0, vec![review_record()])
                .unwrap_err()
                .starts_with("REVIEW_UNAVAILABLE"));
            assert_eq!(fs::read(case.directory.join("review.json")).unwrap(), bytes);
            assert_eq!(opened.official, case.official);
        }
    }

    #[tokio::test]
    async fn cancellation_keeps_valid_official_when_optional_artifacts_are_missing_or_corrupt() {
        for corrupt in [false, true] {
            let temp = Temporary::new();
            let result = temp.0.join("result.json");
            let detail = temp.0.join("detail.json");
            let extra = temp.0.join("extra.json");
            fs::write(&result, official()).unwrap();
            if corrupt {
                fs::write(&detail, b"{broken").unwrap();
                fs::write(&extra, b"{broken").unwrap();
            }
            let bundle = crate::session::load_cancelled_bundle(
                "https://example.kr/",
                &result,
                &detail,
                &extra,
            )
            .unwrap();
            let canonical = validate_sidecar_stdout("https://example.kr/", &official()).unwrap();
            assert_eq!(bundle.0, canonical);
            assert!(bundle.1.is_empty());
            assert!(bundle.2.is_empty());
            let root = temp.0.join("cases");
            let registry = crate::session::SessionRegistry::persistent(root.clone()).unwrap();
            let mut record = crate::session::new_session(
                "https://example.kr/".into(),
                "2026-10-09T00:00:00Z".into(),
            );
            record.cancel_requested = true;
            let id = record.id.clone();
            registry.insert(record).await;
            registry
                .complete_cancellation(&id, Some(bundle), None, "2026-10-09T00:00:01Z".into())
                .await;
            assert_eq!(
                registry.validated_export_text(&id).await.unwrap(),
                canonical
            );
            drop(registry);
            let restarted = crate::session::SessionRegistry::persistent(root).unwrap();
            let case = restarted.open_case(&id).await.unwrap();
            assert_eq!(case["manifest"]["status"], "cancelled");
            assert_eq!(
                restarted.validated_export_text(&id).await.unwrap(),
                canonical
            );
            assert!(case["manifest"]["issues"]
                .as_array()
                .unwrap()
                .iter()
                .any(|issue| issue["scope"] == "evidence"));
        }
    }

    #[tokio::test]
    async fn deleting_a_reopened_case_invalidates_cached_original_and_evidence() {
        let temp = Temporary::new();
        let registry = crate::session::SessionRegistry::persistent(temp.0.join("cases")).unwrap();
        let record = crate::session::new_session(
            "https://example.kr/".into(),
            "2026-10-09T00:00:00Z".into(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        assert!(
            registry
                .store_result(
                    &id,
                    official(),
                    "{}".into(),
                    "{}".into(),
                    "2026-10-09T00:00:01Z".into()
                )
                .await
        );
        registry.open_case(&id).await.unwrap();
        assert!(registry.result_value(&id).await.is_some());
        registry.delete_case(&id).await.unwrap();
        assert!(registry.result_value(&id).await.is_none());
        assert!(registry.validated_export_text(&id).await.is_err());
        assert!(registry.evidence_summary_value(&id).await.is_none());
        assert!(registry.open_case(&id).await.is_err());
        assert!(registry.case_store().unwrap().list().unwrap()["cases"]
            .as_array()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn one_store_owner_serializes_review_revisions_across_restart() {
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let store = CaseStore::new(root.clone()).unwrap();
        assert!(CaseStore::new(root.clone())
            .err()
            .unwrap()
            .contains("already owned"));
        let id = uuid::Uuid::new_v4().to_string();
        store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        assert_eq!(
            store
                .save_review(&id, 0, vec![review_record()])
                .unwrap()
                .revision,
            1
        );
        drop(store);
        let restarted = CaseStore::new(root).unwrap();
        assert_eq!(restarted.open(&id).unwrap().review.revision, 1);
        assert!(restarted
            .save_review(&id, 0, vec![review_record()])
            .unwrap_err()
            .starts_with("REVIEW_CONFLICT"));
        assert_eq!(
            restarted
                .save_review(&id, 1, vec![review_record()])
                .unwrap()
                .revision,
            2
        );
    }

    #[test]
    fn failed_transfers_leave_no_partial_destination_and_original_can_be_retried() {
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let target = CaseStore::new(temp.0.join("target")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let case = source
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let output = temp.0.join("transfer");
        fs::create_dir(&output).unwrap();
        assert!(source
            .export_directory(&id, &case.directory)
            .unwrap_err()
            .contains("outside the case"));
        fs::write(case.directory.join("run.exe"), b"MZ").unwrap();
        assert!(source.export_directory(&id, &output).is_err());
        assert_eq!(fs::read_dir(&output).unwrap().count(), 0);
        assert_eq!(source.open(&id).unwrap().official, case.official);
        fs::remove_file(case.directory.join("run.exe")).unwrap();
        let portable = source.export_directory(&id, &output).unwrap();
        fs::write(
            portable.join("review.json"),
            json!({"schemaVersion":2,"revision":0,"updatedAt":"","records":[]}).to_string(),
        )
        .unwrap();
        assert!(target.import_directory(&portable).is_err());
        assert!(fs::read_dir(target.root())
            .unwrap()
            .all(|entry| entry.unwrap().file_name() == ".store.lock"));
        fs::remove_file(portable.join("review.json")).unwrap();
        assert_eq!(target.import_directory(&portable).unwrap(), id);
        assert_eq!(target.open(&id).unwrap().official, case.official);
    }

    #[test]
    fn import_rejects_manifest_disagreement_before_publishing_identity() {
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let case = source
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let output = temp.0.join("transfer");
        fs::create_dir(&output).unwrap();
        let portable = source.export_directory(&id, &output).unwrap();
        let original: Value =
            serde_json::from_slice(&fs::read(portable.join("manifest.json")).unwrap()).unwrap();
        // Status is host-owned lifecycle metadata, not a claim about the official
        // output; see import_preserves_host_owned_status.
        for (index, (key, value)) in [
            ("findings", json!(2)),
            ("startedAt", json!("different")),
            ("finishedAt", json!("different")),
            ("toolVersion", json!("different")),
            ("policyVersion", json!(3)),
        ]
        .into_iter()
        .enumerate()
        {
            let target = CaseStore::new(temp.0.join(format!("target-{index}"))).unwrap();
            let mut manifest = original.clone();
            manifest[key] = value;
            fs::write(portable.join("manifest.json"), manifest.to_string()).unwrap();
            assert!(
                target.import_directory(&portable).is_err(),
                "accepted {key}"
            );
            assert!(!target.root().join(&id).exists());
        }
        assert_eq!(source.open(&id).unwrap().official, case.official);
    }

    /// The official result carries no status: status records the host's lifecycle
    /// outcome and `mark_cancelled` may rewrite it after the worker finished, so a
    /// portable copy can legitimately carry a status that differs from the original.
    /// Import must preserve that metadata rather than reject the case.
    /// `warp_incomplete_manifest_cannot_reopen_or_import_as_complete` covers the
    /// remaining status constraint: `transportFailure` requires "failed".
    #[test]
    fn import_preserves_host_owned_status() {
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let case = source
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let output = temp.0.join("transfer");
        fs::create_dir(&output).unwrap();
        let portable = source.export_directory(&id, &output).unwrap();
        let original: Value =
            serde_json::from_slice(&fs::read(portable.join("manifest.json")).unwrap()).unwrap();
        for (index, status) in ["cancelled", "failed"].into_iter().enumerate() {
            let target = CaseStore::new(temp.0.join(format!("status-{index}"))).unwrap();
            let mut manifest = original.clone();
            manifest["status"] = json!(status);
            fs::write(portable.join("manifest.json"), manifest.to_string()).unwrap();
            assert_eq!(target.import_directory(&portable).unwrap(), id);
            let reopened = target.open(&id).unwrap();
            assert_eq!(reopened.manifest.status, status);
            assert_eq!(reopened.official, case.official);
        }
        assert_eq!(source.open(&id).unwrap().official, case.official);
    }

    #[test]
    fn large_shared_jpeg_is_deduplicated_and_reopens_with_original_finding_join() {
        use base64::Engine;
        // Real 8x8 JPEG with legal comment segments exceeds the creative-image cap.
        // Finding screenshots have their own larger cap and must survive reconstruction.
        let encoded="/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDgqKKK9s8I/9k=";
        let jpeg = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        let mut bytes = jpeg[..jpeg.len() - 2].to_vec();
        for _ in 0..6 {
            bytes.extend_from_slice(&[0xff, 0xfe, 0xea, 0x62]);
            bytes.extend(std::iter::repeat_n(b'x', 60_000));
        }
        bytes.extend_from_slice(&[0xff, 0xd9]);
        let data = format!(
            "data:image/jpeg;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(&bytes)
        );
        assert!(data.len() > 334_000);
        let rect = json!({"x":0,"y":0,"width":8,"height":8});
        let timing = json!({"workerStartedAt":"2026-10-09T00:00:00Z","officialFinalizedAt":"2026-10-09T00:00:01Z","analysisFinishedAt":"2026-10-09T00:00:02Z","analysisElapsedMs":1234.25});
        let detail=json!({"version":2,"timing":timing,"coverage":{"checkedPages":0,"failedPages":[],"timedOut":false},"pageOutcomes":[],"creativeImages":[],"imageAnalysis":[],
            "findings":[{"findingId":"f1","url":"https://example.kr/","location":"#ad","technique":"HOMOGLYPH","rawText":"ＣＡＳＩＮＯ 가입",
                "visual":{"state":"available","mimeType":"image/jpeg","dataUrl":data,"viewport":{"width":8,"height":8,"deviceScaleFactor":1,"scrollX":0,"scrollY":0},
                    "target":{"state":"available","coordinateSpace":"main-viewport","box":rect},"element":{"state":"available","mimeType":"image/jpeg","dataUrl":data,"box":rect}}}]}).to_string();
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let store = CaseStore::new(root.clone()).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let saved = store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: Some(&detail),
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        assert!(saved.evidence.is_some(), "{:?}", saved.manifest.issues);
        assert_eq!(
            fs::read_dir(saved.directory.join("assets"))
                .unwrap()
                .count(),
            1
        );
        drop(saved);
        drop(store);
        let restarted = CaseStore::new(root).unwrap();
        let case = restarted.open(&id).unwrap();
        let evidence = case.evidence.unwrap();
        assert_eq!(evidence.summary()["timing"], timing);
        let finding = evidence.finding("f1").unwrap();
        assert_eq!(finding["rawText"], "ＣＡＳＩＮＯ 가입");
        assert_eq!(
            finding["visual"]["assetId"],
            finding["visual"]["element"]["assetId"]
        );
        let asset = evidence
            .asset(finding["visual"]["assetId"].as_str().unwrap())
            .unwrap();
        assert_eq!(asset["dataUrl"], data);
        assert_eq!(
            case.official,
            validate_sidecar_stdout("https://example.kr/", &official()).unwrap()
        );
    }

    #[test]
    fn portable_asset_hash_names_cannot_disguise_executables_or_oversized_bytes() {
        let temp = Temporary::new();
        let source = CaseStore::new(temp.0.join("source")).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let case = source
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let assets = case.directory.join("assets");
        fs::create_dir(&assets).unwrap();
        for (index, bytes) in [b"MZ executable payload".to_vec(), vec![0; 525_001]]
            .into_iter()
            .enumerate()
        {
            let target = CaseStore::new(temp.0.join(format!("target-{index}"))).unwrap();
            let path = assets.join(digest(&bytes));
            fs::write(&path, &bytes).unwrap();
            assert!(target.import_directory(&case.directory).is_err());
            assert!(!target.root().join(&id).exists());
            assert!(fs::read_dir(target.root())
                .unwrap()
                .all(|entry| entry.unwrap().file_name() == ".store.lock"));
            fs::remove_file(path).unwrap();
            assert_eq!(source.open(&id).unwrap().official, case.official);
        }
    }

    #[test]
    fn restart_quarantines_interrupted_transactions_without_losing_original_bytes() {
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let store = CaseStore::new(root.clone()).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let saved = store
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        let original = saved.official;
        let pending = root.join(format!(".pending-{}", uuid::Uuid::new_v4()));
        let import = root.join(format!(".import-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&pending).unwrap();
        fs::create_dir(&import).unwrap();
        fs::write(pending.join("result.json"), original.as_bytes()).unwrap();
        fs::write(import.join("review.json"), b"unfinished review bytes").unwrap();
        drop(store);
        let restarted = CaseStore::new(root.clone()).unwrap();
        assert_eq!(restarted.open(&id).unwrap().official, original);
        assert!(!pending.exists());
        assert!(!import.exists());
        let issues = restarted.list().unwrap()["issues"]
            .as_array()
            .unwrap()
            .clone();
        assert_eq!(issues.len(), 2);
        let mut preserved = Vec::new();
        for issue in issues {
            assert_eq!(issue["code"], "QUARANTINED_TRANSACTION");
            let path = root.join(issue["caseId"].as_str().unwrap());
            for entry in fs::read_dir(path).unwrap() {
                preserved.push(fs::read(entry.unwrap().path()).unwrap());
            }
        }
        assert!(preserved.contains(&original.into_bytes()));
        assert!(preserved.contains(&b"unfinished review bytes".to_vec()));
        drop(restarted);
        let again = CaseStore::new(root).unwrap();
        assert_eq!(again.list().unwrap()["issues"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn cancellation_uses_committed_original_when_worker_files_are_unavailable() {
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let registry = crate::session::SessionRegistry::persistent(root.clone()).unwrap();
        let mut record = crate::session::new_session(
            "https://example.kr/".into(),
            "2026-10-09T00:00:00Z".into(),
        );
        record.cancel_requested = true;
        let id = record.id.clone();
        let saved = registry
            .case_store()
            .unwrap()
            .commit(NewCase {
                id: &id,
                entry_url: "https://example.kr/",
                official: &official(),
                detail: None,
                extra: None,
                status: "succeeded",
                settings: json!({}),
            })
            .unwrap();
        registry.insert(record).await;
        registry
            .complete_cancellation(&id, None, None, "2026-10-09T00:00:01Z".into())
            .await;
        assert_eq!(
            registry.validated_export_text(&id).await.unwrap(),
            saved.official
        );
        assert_eq!(
            registry
                .case_store()
                .unwrap()
                .open(&id)
                .unwrap()
                .manifest
                .status,
            "cancelled"
        );
        drop(registry);
        let restarted = crate::session::SessionRegistry::persistent(root).unwrap();
        assert_eq!(
            restarted.open_case(&id).await.unwrap()["manifest"]["status"],
            "cancelled"
        );
        assert_eq!(
            restarted.validated_export_text(&id).await.unwrap(),
            saved.official
        );
    }

    #[test]
    fn shares_case_manifest_and_review_boundaries_with_typescript() {
        let corpus: Value = serde_json::from_str(include_str!(
            "../../packages/contracts/test/fixtures/case-conformance.json"
        ))
        .unwrap();
        let official = corpus["valid"]["official"].to_string();
        let check = |kind: &str, value: Value| match kind {
            "manifest" => serde_json::from_value::<CaseManifest>(value)
                .is_ok_and(|manifest| validate_manifest(&manifest, &official).is_ok()),
            "review" => serde_json::from_value::<CaseReview>(value)
                .is_ok_and(|review| valid_review(&review, &official)),
            _ => false,
        };
        for kind in ["manifest", "review"] {
            assert!(check(kind, corpus["valid"][kind].clone()));
        }
        for sample in corpus["invalid"].as_array().unwrap() {
            let kind = sample["kind"].as_str().unwrap();
            let mut value = corpus["valid"][kind].clone();
            let path = sample["path"].as_array().unwrap();
            let mut target = &mut value;
            for key in &path[..path.len() - 1] {
                target = if let Some(i) = key.as_u64() {
                    &mut target[i as usize]
                } else {
                    &mut target[key.as_str().unwrap()]
                };
            }
            let last = path.last().unwrap();
            if let Some(i) = last.as_u64() {
                target[i as usize] = sample["value"].clone();
            } else {
                target[last.as_str().unwrap()] = sample["value"].clone();
            }
            assert!(!check(kind, value), "{}: {}", kind, sample["name"]);
        }
    }

    fn apply_fixture_path(value: &mut Value, path: &[Value], replacement: Value) {
        let (last, prefix) = path.split_last().unwrap();
        let mut target = value;
        for key in prefix {
            target = match key.as_u64() {
                Some(index) => &mut target[index as usize],
                None => &mut target[key.as_str().unwrap()],
            };
        }
        match last.as_u64() {
            Some(index) => target[index as usize] = replacement,
            None => target[last.as_str().unwrap()] = replacement,
        }
    }

    fn batch_group_fixture() -> Value {
        serde_json::from_str::<Value>(include_str!(
            "../../packages/contracts/test/fixtures/batch-group-conformance.json"
        ))
        .unwrap()["valid"]
            .clone()
    }

    /// The group file is restart identity only: no official bytes, no review records.
    #[test]
    fn batch_group_survives_restart_and_never_becomes_a_case_or_escapes_the_store() {
        let temporary = Temporary::new();
        let store = CaseStore::new(temporary.0.clone()).unwrap();
        let valid = batch_group_fixture();
        let group: BatchGroup = serde_json::from_value(valid.clone()).unwrap();
        assert_eq!(store.save_group(&group).unwrap(), valid);
        // The reserved groups folder must not surface as a case or a case issue.
        let cases = store.list().unwrap();
        assert!(cases["cases"].as_array().unwrap().is_empty());
        assert!(cases["issues"].as_array().unwrap().is_empty());

        drop(store);
        let restarted = CaseStore::new(temporary.0.clone()).unwrap();
        let listed = restarted.list_groups().unwrap();
        assert_eq!(listed["groups"].as_array().unwrap().len(), 1);
        assert_eq!(listed["groups"][0], valid);
        assert!(listed["issues"].as_array().unwrap().is_empty());

        for id in [
            "../../escape",
            "not-a-uuid",
            "abcdef01-2345-6789-abcd-0123456789ab/../x",
        ] {
            let mut forged = group.clone();
            forged.group_id = id.into();
            assert!(restarted.save_group(&forged).is_err(), "{id} accepted");
        }
        assert!(!temporary.0.parent().unwrap().join("escape.json").exists());

        let broken = temporary
            .0
            .join("groups")
            .join("11111111-1111-4111-8111-111111111111.json");
        write_new(&broken, b"{ not json").unwrap();
        let listed = restarted.list_groups().unwrap();
        assert_eq!(listed["groups"].as_array().unwrap().len(), 1);
        assert_eq!(listed["issues"][0]["code"], "BATCH_GROUP_UNAVAILABLE");

        let mut updated = group.clone();
        updated.phase = "complete".into();
        restarted.save_group(&updated).unwrap();
        let names: Vec<String> = fs::read_dir(temporary.0.join("groups"))
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            names.iter().filter(|name| name.ends_with(".json")).count(),
            2
        );
        assert!(names.iter().all(|name| !name.contains(".tmp")));
        let listed = restarted.list_groups().unwrap();
        assert_eq!(listed["groups"][0]["phase"], "complete");
    }

    #[test]
    fn shares_batch_group_boundaries_with_typescript() {
        let corpus: Value = serde_json::from_str(include_str!(
            "../../packages/contracts/test/fixtures/batch-group-conformance.json"
        ))
        .unwrap();
        let check = |value: Value| {
            serde_json::from_value::<BatchGroup>(value).is_ok_and(|group| valid_group(&group))
        };
        assert!(check(corpus["valid"].clone()));
        let invalid = corpus["invalid"].as_array().unwrap();
        assert!(!invalid.is_empty());
        for sample in invalid {
            let mut value = corpus["valid"].clone();
            apply_fixture_path(
                &mut value,
                sample["path"].as_array().unwrap(),
                sample["value"].clone(),
            );
            assert!(!check(value), "{}", sample["name"]);
        }
    }

    #[cfg(unix)]
    #[test]
    fn dropping_owner_releases_lock_while_fork_child_retains_the_descriptor() {
        use std::os::fd::RawFd;
        unsafe extern "C" {
            fn pipe(fds: *mut RawFd) -> i32;
            fn fork() -> i32;
            fn read(fd: RawFd, buf: *mut u8, count: usize) -> isize;
            fn write(fd: RawFd, buf: *const u8, count: usize) -> isize;
            fn close(fd: RawFd) -> i32;
            fn waitpid(pid: i32, status: *mut i32, options: i32) -> i32;
            fn _exit(status: i32) -> !;
        }
        struct HeldChild {
            pid: i32,
            ready: RawFd,
            release: RawFd,
        }
        impl Drop for HeldChild {
            fn drop(&mut self) {
                // SAFETY: descriptors and PID belong to this test; always settle on panic.
                unsafe {
                    let byte = 1u8;
                    write(self.release, &byte, 1);
                    waitpid(self.pid, std::ptr::null_mut(), 0);
                    close(self.ready);
                    close(self.release);
                }
            }
        }
        let temp = Temporary::new();
        let root = temp.0.join("cases");
        let store = CaseStore::new(root.clone()).unwrap();
        let mut ready = [0; 2];
        let mut release = [0; 2];
        // SAFETY: output arrays provide two writable descriptor slots.
        unsafe {
            assert_eq!(pipe(ready.as_mut_ptr()), 0);
            assert_eq!(pipe(release.as_mut_ptr()), 0);
        }
        // SAFETY: the child executes only async-signal-safe libc calls until _exit.
        let pid = unsafe { fork() };
        assert!(pid >= 0);
        if pid == 0 {
            // SAFETY: all buffers live on the child stack; no Rust allocation/unwind.
            unsafe {
                close(ready[0]);
                close(release[1]);
                let byte = 1u8;
                write(ready[1], &byte, 1);
                let mut byte = 0u8;
                read(release[0], &mut byte, 1);
                _exit(0);
            }
        }
        let child = HeldChild {
            pid,
            ready: ready[0],
            release: release[1],
        };
        // SAFETY: the parent owns these pipe ends, and the child signals readiness.
        unsafe {
            close(ready[1]);
            close(release[0]);
            let mut byte = 0u8;
            assert_eq!(read(child.ready, &mut byte, 1), 1);
        }
        assert!(CaseStore::new(root.clone()).is_err());
        drop(store);
        let reopened =
            CaseStore::new(root).expect("dropped owner must release inherited fork lock");
        drop(reopened);
        drop(child);
    }
}
