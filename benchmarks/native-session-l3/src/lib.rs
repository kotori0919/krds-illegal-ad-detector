//! Linux integration smoke for the real Tauri session registry and Node worker.
#![cfg(not(windows))]

#[path = "../../../src-tauri/src/job_fallback.rs"]
mod job_fallback;
#[path = "../../../src-tauri/src/session.rs"]
mod session;

#[cfg(test)]
mod tests {
    use super::session::{new_session, ProgressSink, SessionOutcome, SessionRegistry};
    use std::collections::BTreeSet;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Mutex};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("illegal-ad-native-l3-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn copy_tree(source: &Path, target: &Path) {
        std::fs::create_dir_all(target).unwrap();
        for entry in std::fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            let destination = target.join(entry.file_name());
            if entry.file_type().unwrap().is_dir() {
                copy_tree(&entry.path(), &destination);
            } else {
                std::fs::copy(entry.path(), destination).unwrap();
            }
        }
    }

    #[tokio::test]
    async fn real_worker_progress_result_and_evidence_survive_host_persistence() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let temporary = TempDir::new();
        let resource = temporary.0.join("install-dir/binaries");
        std::fs::create_dir_all(&resource).unwrap();
        let worker_name = "scanner-worker-x86_64-pc-windows-gnu.mjs";
        let worker = resource.join(worker_name);
        std::fs::copy(root.join("src-tauri/binaries").join(worker_name), &worker).unwrap();
        copy_tree(
            &root.join("node_modules/playwright-core"),
            &resource.join("node_modules/playwright-core"),
        );

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let fixture = root.join("fixtures/realistic");
        let server = tokio::spawn(async move {
            loop {
                let (mut stream, _) = listener.accept().await.unwrap();
                let fixture = fixture.clone();
                tokio::spawn(async move {
                    let mut request = [0_u8; 4096];
                    let count = stream.read(&mut request).await.unwrap_or(0);
                    let line = String::from_utf8_lossy(&request[..count]);
                    let url_path = line.split_whitespace().nth(1).unwrap_or("/");
                    let name = if url_path == "/" {
                        "index.html"
                    } else {
                        url_path.trim_start_matches('/')
                    };
                    let valid = name.ends_with(".html")
                        && name
                            .chars()
                            .all(|c| c.is_ascii_lowercase() || c == '-' || c == '.');
                    let (status, body) = if valid {
                        match std::fs::read(fixture.join(name)) {
                            Ok(body) => ("200 OK", body),
                            Err(_) => ("404 Not Found", b"missing".to_vec()),
                        }
                    } else {
                        ("404 Not Found", b"missing".to_vec())
                    };
                    let headers = format!("HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                    let _ = stream.write_all(headers.as_bytes()).await;
                    let _ = stream.write_all(&body).await;
                });
            }
        });

        let entry = format!("{origin}/");
        let registry = SessionRegistry::shared();
        let record = new_session(
            entry.clone(),
            "municipal-style-fixture".to_string(),
            chrono::Utc::now().to_rfc3339(),
        );
        let id = record.id.clone();
        registry.insert(record).await;
        let result_file = temporary.0.join("result.json");
        let detail_file = temporary.0.join("detail.json");
        let extra_file = temporary.0.join("result_extra.json");
        let result_name = result_file.to_string_lossy().to_string();
        let detail_name = detail_file.to_string_lossy().to_string();
        let extra_name = extra_file.to_string_lossy().to_string();
        let args = [
            "--session",
            id.as_str(),
            "--entry-url",
            entry.as_str(),
            "--topic",
            "municipal-style-fixture",
            "--max-pages",
            "6",
            "--max-depth",
            "2",
            "--timeout-sec",
            "90",
            "--settle-ms",
            "1400",
            "--out-file",
            result_name.as_str(),
            "--detail-out-file",
            detail_name.as_str(),
            "--extra-out-file",
            extra_name.as_str(),
        ];
        registry
            .spawn_sidecar(&id, worker.to_str().unwrap(), &args)
            .await
            .unwrap();
        let events = Arc::new(Mutex::new(Vec::<serde_json::Value>::new()));
        let collected = events.clone();
        let sink: ProgressSink = Arc::new(move |event| collected.lock().unwrap().push(event));
        match registry.wait_sidecar_with_progress(&id, sink).await {
            SessionOutcome::Succeeded { stdout } => assert!(stdout.is_empty()),
            SessionOutcome::Failed { detail } => panic!("real worker failed: {detail}"),
            SessionOutcome::Cancelled => panic!("real worker was cancelled"),
        }

        let official_text = std::fs::read_to_string(&result_file).unwrap();
        let detail_text = std::fs::read_to_string(&detail_file).unwrap();
        let extra_text = std::fs::read_to_string(&extra_file).unwrap();
        let official: serde_json::Value = serde_json::from_str(&official_text).unwrap();
        let detail: serde_json::Value = serde_json::from_str(&detail_text).unwrap();
        let extra: serde_json::Value = serde_json::from_str(&extra_text).unwrap();
        assert_eq!(extra["meta"], official["meta"]);
        let findings = official["findings"].as_array().unwrap();
        let detail_findings = detail["findings"].as_array().unwrap();
        let truth: serde_json::Value = serde_json::from_slice(
            &std::fs::read(root.join("fixtures/realistic/ground-truth.json")).unwrap(),
        )
        .unwrap();
        let expected: BTreeSet<String> = truth["positive"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| {
                format!(
                    "{}\0{}\0{}",
                    item["page"].as_str().unwrap(),
                    item["selector"].as_str().unwrap(),
                    item["technique"].as_str().unwrap()
                )
            })
            .collect();
        let actual: BTreeSet<String> = findings
            .iter()
            .map(|finding| {
                let url = finding["url"].as_str().unwrap();
                let page = &url[origin.len()..];
                let location = finding["location"].as_str().unwrap();
                let selector = location.rsplit(">>>").next().unwrap().trim();
                format!(
                    "{page}\0{selector}\0{}",
                    finding["technique"].as_str().unwrap()
                )
            })
            .collect();
        assert_eq!(actual, expected);
        assert_eq!(findings.len(), 5);
        assert_eq!(detail_findings.len(), 5);
        assert_eq!(detail["coverage"]["checkedPages"], 5);
        assert_eq!(
            detail["coverage"]["failedPages"].as_array().unwrap().len(),
            1
        );
        let official_ids: BTreeSet<_> = findings
            .iter()
            .map(|finding| finding["id"].as_str().unwrap())
            .collect();
        let detail_ids: BTreeSet<_> = detail_findings
            .iter()
            .map(|finding| finding["findingId"].as_str().unwrap())
            .collect();
        assert_eq!(official_ids, detail_ids);
        assert!(detail_findings.iter().all(|finding| {
            finding["visual"]["state"] == "available"
                && finding["visual"]["dataUrl"]
                    .as_str()
                    .unwrap()
                    .starts_with("data:image/jpeg;base64,/9j/")
        }));
        assert!(events
            .lock()
            .unwrap()
            .iter()
            .any(|event| event["kind"] == "page-visited"));
        let progress = registry.progress_snapshot(&id).await;
        assert_eq!(progress.pages, 6);
        assert_eq!(progress.failed_pages, 1);
        assert_eq!(progress.current_pages, Vec::<String>::new());
        let active = registry.snapshot(&id).await.unwrap();
        assert_eq!(active["status"], "finalizing");
        assert_eq!(active["progress"]["visitedPages"], 6);
        assert_eq!(active["progress"]["failedPages"], 1);
        assert_eq!(active["progress"]["recentActivity"], serde_json::json!(progress.recent_activity));
        let seen = events.lock().unwrap();
        let started: Vec<&serde_json::Value> = seen.iter().filter(|event| event["kind"] == "page-started").collect();
        assert_eq!(started.len(), 6);
        for event in started {
            assert!(event["progress"]["currentPages"].as_array().unwrap().contains(&event["pageUrl"]));
        }
        let failed: Vec<&serde_json::Value> = seen.iter().filter(|event| event["kind"] == "page-failed").collect();
        assert_eq!(failed.len(), 1);
        assert!(failed[0]["pageUrl"].as_str().unwrap().ends_with("/missing.html"));
        assert_eq!(failed[0]["progress"]["failedPages"], 1);
        drop(seen);
        registry
            .store_result(
                &id,
                official_text,
                detail_text,
                extra_text,
                chrono::Utc::now().to_rfc3339(),
            )
            .await;
        let terminal = registry.snapshot(&id).await.unwrap();
        assert_eq!(terminal["status"], "succeeded");
        assert_eq!(terminal["progress"]["confirmedFindings"], 5);
        assert_eq!(terminal["progress"]["currentPages"], serde_json::json!([]));
        assert_eq!(terminal["progress"]["recentActivity"][0]["kind"], "session-finished");
        assert_eq!(
            registry.result_value(&id).await.unwrap()["findings"]
                .as_array()
                .unwrap()
                .len(),
            5
        );
        assert_eq!(
            registry.detail_value(&id).await.unwrap()["coverage"]["checkedPages"],
            5
        );
        assert_eq!(registry.extra_value(&id).await.unwrap(), extra);
        println!("native L3: 5 official, 5 JPEG detail, 5 checked, 1 failed, {} progress events, persisted succeeded", events.lock().unwrap().len());
        server.abort();
    }
}
