//! Canonical native process/filesystem contract validation.
use std::collections::HashMap;

fn visual_uri<'a>(
    value: &'a serde_json::Value,
    shared: &HashMap<&str, &'a serde_json::Value>,
) -> Option<&'a str> {
    if let Some(id) = value["assetId"].as_str() {
        if value.get("dataUrl").is_some() {
            return None;
        }
        let asset = shared.get(id)?;
        if asset["mimeType"] != "image/jpeg" {
            return None;
        }
        return asset["dataUrl"].as_str();
    }
    value["dataUrl"].as_str()
}
/// BOM-free UTF-8, valid JSON, complete meta, required finding fields,
/// official technique enum only, unique ids, no duplicate
/// url+location+technique identities, and request/result entry_url match.
/// Any violation fails the session and is never exportable (KODEX §38).
pub(crate) fn validate_sidecar_stdout(entry_url: &str, stdout: &str) -> Result<String, String> {
    if stdout.starts_with('\u{FEFF}') {
        return Err("sidecar result contained a BOM".to_string());
    }
    let parsed: serde_json::Value =
        serde_json::from_str(stdout).map_err(|e| format!("sidecar result is not JSON: {e}"))?;
    let meta = parsed.get("meta").ok_or("sidecar result missing meta")?;
    let http_url = |value: &serde_json::Value| {
        value.as_str().is_some_and(|s| {
            (s.starts_with("https://") || s.starts_with("http://"))
                && s.split_once("://")
                    .is_some_and(|(_, host)| !host.is_empty())
                && !s.chars().any(char::is_whitespace)
        })
    };
    if meta["topic"] != "TOPIC"
        || !http_url(&meta["entry_url"])
        || !meta["tool_version"]
            .as_str()
            .is_some_and(|s| !s.trim().is_empty())
        || !meta["elapsed_sec"]
            .as_f64()
            .is_some_and(|v| v.is_finite() && v >= 0.0)
        || ["started_at", "finished_at"].iter().any(|k| {
            !meta[*k]
                .as_str()
                .is_some_and(|s| chrono::DateTime::parse_from_rfc3339(s).is_ok())
        })
    {
        return Err("sidecar result metadata invalid".into());
    }
    for field in [
        "topic",
        "entry_url",
        "started_at",
        "finished_at",
        "elapsed_sec",
        "tool_version",
    ] {
        if meta.get(field).is_none() {
            return Err(format!("sidecar result meta.{field} is required"));
        }
    }
    let result_url = meta.get("entry_url").and_then(|u| u.as_str()).unwrap_or("");
    if result_url.is_empty() {
        return Err("sidecar result meta.entry_url must be a non-empty string".to_string());
    }
    if result_url != entry_url {
        return Err(format!(
            "sidecar result entry_url mismatch: request {entry_url} vs result {result_url}"
        ));
    }
    let findings = parsed
        .get("findings")
        .and_then(|f| f.as_array())
        .ok_or("sidecar result findings must be an array")?;
    let mut ids = std::collections::HashSet::new();
    let mut identities = std::collections::HashSet::new();
    for (i, item) in findings.iter().enumerate() {
        let at = format!("findings[{i}]");
        for field in [
            "id",
            "url",
            "is_violation",
            "location",
            "evidence_text",
            "technique",
        ] {
            if item.get(field).is_none() {
                return Err(format!("sidecar result {at}.{field} is required"));
            }
        }
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or(format!("sidecar result {at}.id must be a string"))?;
        if id.trim().is_empty()
            || !http_url(&item["url"])
            || !item["is_violation"].is_boolean()
            || !item["evidence_text"].is_string()
        {
            return Err(format!("sidecar result {at} field type invalid"));
        }
        if !ids.insert(id.to_string()) {
            return Err(format!("sidecar result {at}.id is duplicated"));
        }
        let technique = item.get("technique").and_then(|v| v.as_str()).unwrap_or("");
        if !matches!(
            technique,
            "HOMOGLYPH" | "JAMO" | "TRANSPARENT" | "OFFSCREEN"
        ) {
            return Err(format!("sidecar result {at}.technique must be one of HOMOGLYPH, JAMO, TRANSPARENT, OFFSCREEN"));
        }
        let url = item.get("url").and_then(|v| v.as_str()).unwrap_or("");
        let location = item.get("location").and_then(|v| v.as_str()).unwrap_or("");
        if location.trim().is_empty() {
            return Err(format!("sidecar result {at}.location must be non-empty"));
        }
        let key = format!("{url}\u{0}{location}\u{0}{technique}");
        if !identities.insert(key) {
            return Err(format!(
                "sidecar result {at} duplicates url+location+technique"
            ));
        }
    }
    let canonical = serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("sidecar result not serializable: {e}"))?;
    if canonical.starts_with('\u{FEFF}') {
        return Err("canonical serializer emitted a BOM".to_string());
    }
    Ok(format!("{canonical}\n"))
}

/// Bind every internal detail to a validated official finding. Visual bytes
/// remain in the session-local manifest and never enter result.json.
fn valid_text_policy(policy: &serde_json::Value, source: &str) -> bool {
    let Some(analysis) = policy["analysisText"].as_str() else {
        return false;
    };
    let analysis: Vec<u16> = analysis.encode_utf16().collect();
    let source: Vec<u16> = source.encode_utf16().collect();
    let allowed = |value: &serde_json::Value, options: &[&str]| -> bool {
        let Some(items) = value.as_array() else {
            return false;
        };
        let mut seen = std::collections::HashSet::new();
        items.len() <= options.len()
            && items.iter().all(|item| {
                item.as_str()
                    .is_some_and(|s| options.contains(&s) && seen.insert(s))
            })
    };
    if policy["version"] != "text-policy-2"
        || analysis.len() > 32768
        || !policy["truncated"].is_boolean()
        || !matches!(policy["alignment"].as_str(), Some("exact" | "unavailable"))
        || !allowed(
            &policy["reasonCodes"],
            &[
                "AD_CATEGORY",
                "AD_OFFER",
                "OBSERVED_DESTINATION_PATTERN",
                "PUBLIC_INFORMATION",
                "QUOTED_PUBLIC_EXAMPLE",
                "LIBRARY_SERVICE",
                "NO_SUPPORTED_AD_EVIDENCE",
                "TEXT_ANALYSIS_LIMIT",
            ],
        )
    {
        return false;
    }
    let index = |value: &serde_json::Value| {
        value
            .as_u64()
            .filter(|n| *n <= 9_007_199_254_740_991)
            .and_then(|n| usize::try_from(n).ok())
    };
    let boundary = |text: &[u16], n: usize| {
        n == 0
            || n == text.len()
            || !(matches!(text[n - 1], 0xd800..=0xdbff) && matches!(text[n], 0xdc00..=0xdfff))
    };
    for (key, transformed) in [
        ("matches", true),
        ("techniqueSpans", true),
        ("offerSpans", false),
        ("quotedSpans", false),
    ] {
        let Some(spans) = policy[key].as_array() else {
            return false;
        };
        if spans.len() > 32768 {
            return false;
        }
        for span in spans {
            let (Some(start), Some(end), Some(raw)) = (
                index(&span["start"]),
                index(&span["end"]),
                span["raw"].as_str(),
            ) else {
                return false;
            };
            if start >= end
                || end > analysis.len()
                || !boundary(&analysis, start)
                || !boundary(&analysis, end)
                || !analysis[start..end].iter().copied().eq(raw.encode_utf16())
                || transformed
                    && (span["term"]
                        .as_str()
                        .is_none_or(|s| s.is_empty() || s.encode_utf16().count() > 128)
                        || !allowed(
                            &span["transforms"],
                            &["width", "case", "cyrillic", "jamo", "separator", "leet"],
                        ))
            {
                return false;
            }
        }
    }
    let Some(mapping) = policy["sourceMapping"].as_array() else {
        return false;
    };
    if mapping.len() > 10000 {
        return false;
    }
    if policy["alignment"] == "unavailable" {
        return mapping.is_empty();
    }
    let mut analysis_end = 0;
    let mut source_end = 0;
    for segment in mapping {
        let (Some(a), Some(s), Some(length)) = (
            index(&segment["analysisStart"]),
            index(&segment["sourceStart"]),
            index(&segment["length"]),
        ) else {
            return false;
        };
        let (Some(a_end), Some(s_end)) = (a.checked_add(length), s.checked_add(length)) else {
            return false;
        };
        if length == 0
            || a != analysis_end
            || s < source_end
            || a_end > analysis.len()
            || s_end > source.len()
            || !boundary(&analysis, a)
            || !boundary(&analysis, a_end)
            || !boundary(&source, s)
            || !boundary(&source, s_end)
            || analysis[a..a_end] != source[s..s_end]
        {
            return false;
        }
        analysis_end = a_end;
        source_end = s_end;
    }
    analysis_end == analysis.len()
}

pub(crate) fn validate_detail_bundle(
    official_text: &str,
    detail_text: &str,
    extra_text: &str,
) -> Result<(), String> {
    if detail_text.len() > 8_000_000 {
        return Err("detail manifest exceeds size limit".to_string());
    }
    let official: serde_json::Value =
        serde_json::from_str(official_text).map_err(|e| e.to_string())?;
    let detail: serde_json::Value = serde_json::from_str(detail_text)
        .map_err(|e| format!("detail manifest invalid JSON: {e}"))?;
    if detail.get("version").and_then(|v| v.as_u64()) != Some(2) {
        return Err("detail manifest version must be 2".to_string());
    }
    let expected = official["findings"]
        .as_array()
        .ok_or("official findings missing")?;
    let actual = detail["findings"]
        .as_array()
        .ok_or("detail findings missing")?;
    if expected.len() != actual.len() {
        return Err("detail finding count mismatch".to_string());
    }
    let actual_by_id: HashMap<&str, &serde_json::Value> = actual
        .iter()
        .filter_map(|item| item["findingId"].as_str().map(|id| (id, item)))
        .collect();
    if actual_by_id.len() != actual.len() {
        return Err("detail finding IDs invalid or duplicated".into());
    }
    let shared: HashMap<&str, &serde_json::Value> = detail["visualAssets"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|a| a["assetId"].as_str().map(|id| (id, a)))
        .collect();
    for finding in expected {
        let id = finding["id"]
            .as_str()
            .ok_or("official finding id missing")?;
        let item = actual_by_id
            .get(id)
            .ok_or(format!("detail missing official finding {id}"))?;
        for (source, target) in [
            ("url", "url"),
            ("location", "location"),
            ("technique", "technique"),
            ("evidence_text", "rawText"),
        ] {
            if finding[source] != item[target] {
                return Err(format!("detail {id} {target} mismatch"));
            }
        }
        if let Some(selector) = item["observed"].get("selector") {
            if selector.as_str().is_none_or(str::is_empty) {
                return Err(format!("detail {id} observed selector invalid"));
            }
        }
        if item
            .get("textPolicy")
            .is_some_and(|p| !valid_text_policy(p, item["rawText"].as_str().unwrap_or_default()))
        {
            return Err(format!("detail {id} text policy invalid"));
        }
        if item["observed"]
            .get("renderingIssues")
            .is_some_and(|issues| {
                issues.as_array().is_none_or(|items| {
                    items.len() > 32
                        || items.iter().any(|issue| {
                            issue
                                .as_str()
                                .is_none_or(|s| s.is_empty() || s.encode_utf16().count() > 256)
                        })
                })
            })
        {
            return Err(format!("detail {id} rendering issues invalid"));
        }
        let visual = &item["visual"];
        match visual["state"].as_str() {
            Some("available") => {
                let uri = visual_uri(visual, &shared)
                    .ok_or(format!("detail {id} visual data missing"))?;
                if !uri.starts_with("data:image/jpeg;base64,") || uri.len() > 700_000 {
                    return Err(format!("detail {id} visual data invalid"));
                }
                let valid_box = |rect: &serde_json::Value| {
                    ["x", "y", "width", "height"].iter().all(|key| {
                        rect[*key]
                            .as_f64()
                            .map(|value| value.is_finite())
                            .unwrap_or(false)
                    }) && rect["width"].as_f64().unwrap_or(0.0) > 0.0
                        && rect["height"].as_f64().unwrap_or(0.0) > 0.0
                };
                let viewport = &visual["viewport"];
                let width = viewport["width"]
                    .as_f64()
                    .filter(|value| value.is_finite() && *value > 0.0)
                    .ok_or(format!("detail {id} viewport width invalid"))?;
                let height = viewport["height"]
                    .as_f64()
                    .filter(|value| value.is_finite() && *value > 0.0)
                    .ok_or(format!("detail {id} viewport height invalid"))?;
                if !viewport["deviceScaleFactor"]
                    .as_f64()
                    .map(|value| value.is_finite() && value > 0.0)
                    .unwrap_or(false)
                {
                    return Err(format!("detail {id} device scale invalid"));
                }
                if !["scrollX", "scrollY"].iter().all(|key| {
                    viewport[*key]
                        .as_f64()
                        .map(|value| value.is_finite())
                        .unwrap_or(false)
                }) {
                    return Err(format!("detail {id} viewport scroll invalid"));
                }
                let target = &visual["target"];
                match target["state"].as_str() {
                    Some("available")
                        if valid_box(&target["box"])
                            && target["coordinateSpace"] == "main-viewport" => {}
                    Some("unavailable") if target["reason"] == "target-unavailable" => {}
                    _ => return Err(format!("detail {id} target invalid")),
                }
                let element = &visual["element"];
                match element["state"].as_str() {
                    Some("available") => {
                        let image = visual_uri(element, &shared)
                            .ok_or(format!("detail {id} element data missing"))?;
                        let rect = &element["box"];
                        if target["state"] != "available"
                            || !valid_box(rect)
                            || element["mimeType"] != "image/jpeg"
                            || !image.starts_with("data:image/jpeg;base64,")
                            || image.len() > 700_000
                            || rect["x"].as_f64().unwrap_or(-1.0) < 0.0
                            || rect["y"].as_f64().unwrap_or(-1.0) < 0.0
                            || rect["x"].as_f64().unwrap_or(0.0)
                                + rect["width"].as_f64().unwrap_or(0.0)
                                > width
                            || rect["y"].as_f64().unwrap_or(0.0)
                                + rect["height"].as_f64().unwrap_or(0.0)
                                > height
                        {
                            return Err(format!("detail {id} element capture invalid"));
                        }
                    }
                    Some("unavailable")
                        if matches!(
                            element["reason"].as_str(),
                            Some(
                                "budget"
                                    | "capture-error"
                                    | "outside-viewport"
                                    | "target-unavailable"
                            )
                        ) && element.get("dataUrl").is_none() => {}
                    _ => return Err(format!("detail {id} element state invalid")),
                }
            }
            Some("unavailable") => {
                if visual.get("dataUrl").is_some() || visual.get("assetId").is_some() {
                    return Err(format!("detail {id} unavailable visual has data"));
                }
            }
            _ => return Err(format!("detail {id} visual state invalid")),
        }
    }
    if let Some(timing) = detail.get("timing") {
        let dates: Option<Vec<_>> = [
            "workerStartedAt",
            "officialFinalizedAt",
            "analysisFinishedAt",
        ]
        .iter()
        .map(|key| {
            timing[*key]
                .as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        })
        .collect();
        if dates
            .as_ref()
            .is_none_or(|dates| dates[0] > dates[1] || dates[1] > dates[2])
            || timing["analysisElapsedMs"]
                .as_f64()
                .is_none_or(|n| !n.is_finite() || !(0.0..=9_007_199_254_740_991.0).contains(&n))
        {
            return Err("detail timing invalid".into());
        }
    }
    let coverage = detail.get("coverage").ok_or("detail coverage missing")?;
    let checked = coverage["checkedPages"]
        .as_u64()
        .ok_or("detail checkedPages missing")?;
    if checked > 9_007_199_254_740_991 {
        return Err("detail checkedPages invalid".to_string());
    }
    let failed_pages = coverage["failedPages"]
        .as_array()
        .ok_or("detail failedPages missing")?;
    if !coverage["timedOut"].is_boolean()
        || coverage
            .get("cancelled")
            .is_some_and(|value| !value.is_boolean())
    {
        return Err("detail coverage flags invalid".to_string());
    }
    let nonempty_string =
        |value: &serde_json::Value| value.as_str().is_some_and(|text| !text.is_empty());
    let safe_integer = |value: &serde_json::Value| {
        value
            .as_u64()
            .is_some_and(|number| number <= 9_007_199_254_740_991)
    };
    for page in failed_pages {
        if !nonempty_string(&page["url"])
            || !safe_integer(&page["status"])
            || !nonempty_string(&page["reason"])
        {
            return Err("detail failed page invalid".to_string());
        }
    }
    if let Some(outcomes) = detail.get("pageOutcomes") {
        let outcomes = outcomes
            .as_array()
            .ok_or("detail pageOutcomes must be an array")?;
        if outcomes.len() > 200 {
            return Err("detail pageOutcomes exceeds limit".to_string());
        }
        let mut urls = std::collections::HashSet::new();
        let mut checked_count = 0;
        let mut failed_count = 0;
        for page in outcomes {
            if !nonempty_string(&page["url"])
                || !nonempty_string(&page["finalUrl"])
                || !safe_integer(&page["status"])
                || !safe_integer(&page["depth"])
                || page
                    .get("reason")
                    .is_some_and(|reason| !nonempty_string(reason))
            {
                return Err("detail page outcome invalid".to_string());
            }
            if !urls.insert(page["url"].as_str().unwrap()) {
                return Err("detail page outcome URL duplicated".to_string());
            }
            let status = page["status"].as_u64().unwrap();
            let issue = page.get("issue");
            if let Some(issue) = issue {
                let kinds = [
                    "challenge",
                    "denied",
                    "rate-limit",
                    "login-required",
                    "timeout",
                    "navigation",
                    "network-policy",
                    "unknown",
                ];
                if !issue["kind"]
                    .as_str()
                    .is_some_and(|kind| kinds.contains(&kind))
                    || !issue["retryable"].is_boolean()
                    || issue.get("retryAfterMs").is_some_and(|ms| {
                        !ms.as_u64().is_some_and(|ms| ms <= 9_007_199_254_740_991)
                    })
                {
                    return Err("detail page issue invalid".to_string());
                }
            }
            if page.get("discoverySource").is_some_and(|source| {
                !source
                    .as_str()
                    .is_some_and(|source| ["entry", "link", "sitemap"].contains(&source))
            }) {
                return Err("detail discovery source invalid".to_string());
            }
            if let Some(issues) = page.get("collectionIssues") {
                let issues = issues
                    .as_array()
                    .ok_or("detail page collection issues invalid")?;
                let mut unique = std::collections::HashSet::new();
                if issues.len() > 32
                    || issues.iter().any(|issue| {
                        !issue.as_str().is_some_and(|value| {
                            !value.is_empty() && value.len() <= 256 && unique.insert(value)
                        })
                    })
                {
                    return Err("detail page collection issues invalid".to_string());
                }
            }
            let was_checked = status > 0 && status < 400 && issue.is_none();
            if page["outcome"] != if was_checked { "checked" } else { "failed" } {
                return Err("detail page outcome status mismatch".to_string());
            }
            if was_checked {
                checked_count += 1;
            } else {
                failed_count += 1;
                if !failed_pages.iter().any(|failed| {
                    failed["url"] == page["url"] && failed["status"] == page["status"]
                }) {
                    return Err("detail page outcome missing failed coverage".to_string());
                }
            }
        }
        if checked_count != checked || failed_count != failed_pages.len() as u64 {
            return Err("detail page outcomes coverage mismatch".to_string());
        }
    }
    if let Some(analysis) = detail.get("imageAnalysis") {
        let analysis = analysis
            .as_array()
            .ok_or("detail imageAnalysis must be an array")?;
        if analysis.len() > 64 {
            return Err("detail imageAnalysis exceeds limit".to_string());
        }
        let string_array = |value: &serde_json::Value| {
            value
                .as_array()
                .is_some_and(|items| items.iter().all(nonempty_string))
        };
        for image in analysis {
            if !nonempty_string(&image["sourceUrl"])
                || !string_array(&image["pageUrls"])
                || image["pageUrls"].as_array().is_none_or(Vec::is_empty)
                || !string_array(&image["matchedTerms"])
                || image
                    .get("normalizedText")
                    .is_some_and(|text| !text.is_string())
            {
                return Err("detail image analysis identity invalid".to_string());
            }
            let ocr = &image["ocr"];
            if !nonempty_string(&ocr["backend"]) {
                return Err("detail OCR backend invalid".to_string());
            }
            match ocr["state"].as_str() {
                Some("available")
                    if ocr["text"].is_string()
                        && ocr["confidence"].as_f64().is_some_and(|confidence| {
                            confidence.is_finite() && (0.0..=1.0).contains(&confidence)
                        }) => {}
                Some("unavailable")
                    if matches!(ocr["reason"].as_str(), Some("budget" | "recognition-error")) => {}
                _ => return Err("detail OCR result invalid".to_string()),
            }
            let decision = &image["decision"];
            if !nonempty_string(&decision["rule"])
                || !nonempty_string(&decision["detail"])
                || !decision["passed"].is_boolean()
                || !["score", "threshold"]
                    .iter()
                    .all(|field| decision[*field].as_f64().is_some_and(f64::is_finite))
            {
                return Err("detail image analysis decision invalid".to_string());
            }
            if decision["passed"].as_bool()
                != Some(
                    decision["score"].as_f64().unwrap() >= decision["threshold"].as_f64().unwrap(),
                )
            {
                return Err("detail image analysis decision threshold mismatch".to_string());
            }
        }
    }
    let extra: serde_json::Value = serde_json::from_str(extra_text).map_err(|e| e.to_string())?;
    let extras = extra["findings"]
        .as_array()
        .ok_or("extra findings missing")?;
    let images = detail["creativeImages"]
        .as_array()
        .ok_or("detail creativeImages missing")?;
    if images.len() > 64 {
        return Err("detail creativeImages exceeds limit".to_string());
    }
    let mut ids = std::collections::HashSet::new();
    let mut image_chars = 0;
    for image in images {
        let id = image["findingId"]
            .as_str()
            .ok_or("creative image findingId missing")?;
        let finding = extras
            .iter()
            .find(|finding| finding["id"] == id)
            .ok_or("creative image finding missing")?;
        if !ids.insert(id)
            || finding["extra_finding"] != "REUSED_AD_CREATIVE"
            || finding["url"] != image["sourceUrl"]
            || finding["location"] != image["sourceUrl"]
        {
            return Err("creative image identity invalid".to_string());
        }
        let mime = image["mimeType"]
            .as_str()
            .ok_or("creative image MIME missing")?;
        let data = image["dataUrl"]
            .as_str()
            .or_else(|| {
                image["assetId"]
                    .as_str()
                    .and_then(|id| shared.get(id))
                    .filter(|asset| asset["mimeType"] == mime)
                    .and_then(|asset| asset["dataUrl"].as_str())
            })
            .ok_or("creative image data missing")?;
        let hash = image["sha256"]
            .as_str()
            .ok_or("creative image hash missing")?;
        let encoded = data
            .split_once(',')
            .map(|(_, payload)| payload)
            .unwrap_or("");
        let content = encoded.trim_end_matches('=');
        if !matches!(mime, "image/png" | "image/jpeg" | "image/webp")
            || !data.starts_with(&format!("data:{mime};base64,"))
            || data.len() > 334_000
            || content.is_empty()
            || encoded.len() - content.len() > 2
            || !content
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/')
            || hash.len() != 64
            || !hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || image["width"].as_u64().unwrap_or(0) < 8
            || image["height"].as_u64().unwrap_or(0) < 8
            || image["capturedAt"]
                .as_str()
                .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                .is_none()
        {
            return Err("creative image representation invalid".to_string());
        }
        image_chars += image["dataUrl"].as_str().map_or(0, str::len);
    }
    if image_chars > 2_670_000 {
        return Err("creative images exceed capture budget".to_string());
    }
    crate::evidence::validate_extensions(&detail, extras)?;
    Ok(())
}

pub(crate) fn validate_extra_bundle(official_text: &str, extra_text: &str) -> Result<(), String> {
    if extra_text.len() > 1_000_000 {
        return Err("extra result exceeds size limit".to_string());
    }
    if extra_text.starts_with('\u{FEFF}') {
        return Err("extra result contained a BOM".to_string());
    }
    let official: serde_json::Value =
        serde_json::from_str(official_text).map_err(|e| e.to_string())?;
    let extra: serde_json::Value =
        serde_json::from_str(extra_text).map_err(|e| format!("extra result invalid JSON: {e}"))?;
    for field in [
        "topic",
        "entry_url",
        "started_at",
        "finished_at",
        "elapsed_sec",
        "tool_version",
    ] {
        if extra["meta"][field] != official["meta"][field] {
            return Err(format!("extra result meta.{field} mismatch"));
        }
    }
    let findings = extra["findings"]
        .as_array()
        .ok_or("extra findings must be an array")?;
    let mut ids = std::collections::HashSet::new();
    for (index, finding) in findings.iter().enumerate() {
        let at = format!("extra findings[{index}]");
        let id = finding["id"].as_str().ok_or(format!("{at}.id missing"))?;
        if !ids.insert(id) {
            return Err(format!("{at}.id duplicated"));
        }
        if finding["technique"].as_str() != Some("ETC") {
            return Err(format!("{at}.technique must be ETC"));
        }
        if !matches!(
            finding["extra_finding"].as_str(),
            Some(
                "IMAGE_ONLY_ILLEGAL_AD"
                    | "REUSED_AD_CREATIVE"
                    | "AD_INFRASTRUCTURE_CORRELATION"
                    | "ZERO_WIDTH_OBFUSCATION"
            )
        ) {
            return Err(format!("{at}.extra_finding invalid"));
        }
        for field in ["url", "location", "evidence_text"] {
            if finding[field].as_str().is_none_or(str::is_empty) {
                return Err(format!("{at}.{field} missing"));
            }
        }
        if finding["is_violation"].as_bool() != Some(true) {
            return Err(format!("{at}.is_violation invalid"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod validation_tests {
    use super::{validate_detail_bundle, validate_extra_bundle, validate_sidecar_stdout};

    fn good_json() -> String {
        "{\"meta\":{\"topic\":\"TOPIC\",\"entry_url\":\"https://example.kr/\",\"started_at\":\"2026-10-01T00:00:00Z\",\"finished_at\":\"2026-10-01T00:01:00Z\",\"elapsed_sec\":60,\"tool_version\":\"0.1.0\"},\"findings\":[{\"id\":\"f1\",\"url\":\"https://example.kr/a\",\"is_violation\":true,\"location\":\"#a\",\"evidence_text\":\"x\",\"technique\":\"HOMOGLYPH\"}]}".to_string()
    }

    #[test]
    fn rejects_unreconciled_page_outcomes_and_invalid_ocr_decisions() {
        let detail = serde_json::json!({
            "version": 2, "creativeImages": [],
            "findings": [{"findingId":"f1", "url":"https://example.kr/a", "location":"#a",
                "technique":"HOMOGLYPH", "rawText":"x", "observed":{"selector":"#source"},
                "visual":{"state":"unavailable","reason":"budget"}}],
            "coverage": {"checkedPages":1,"failedPages":[{"url":"https://example.kr/slow","status":0,"reason":"cancelled"}],
                "timedOut":false,"cancelled":true},
            "pageOutcomes": [
                {"url":"https://example.kr/a","finalUrl":"https://example.kr/a","status":200,"depth":0,"outcome":"checked"},
                {"url":"https://example.kr/slow","finalUrl":"https://example.kr/slow","status":0,"depth":1,"outcome":"failed","reason":"cancelled"}],
            "imageAnalysis": [{"sourceUrl":"https://example.kr/ad.png","pageUrls":["https://example.kr/a"],
                "ocr":{"state":"available","backend":"local","text":"ad","confidence":0.9},"normalizedText":"ad",
                "matchedTerms":["ad"],"decision":{"rule":"semantic","score":1,"threshold":0.5,"passed":true,"detail":"matching text"}}]
        });
        let check = |value: &serde_json::Value| {
            validate_detail_bundle(&good_json(), &value.to_string(), "{\"findings\":[]}")
        };
        assert!(check(&detail).is_ok());
        let mut challenge = detail.clone();
        challenge["pageOutcomes"][0]["issue"] =
            serde_json::json!({"kind":"challenge","retryable":false});
        assert_eq!(
            check(&challenge).unwrap_err(),
            "detail page outcome status mismatch"
        );
        challenge["pageOutcomes"][0]["outcome"] = serde_json::json!("failed");
        challenge["coverage"]["checkedPages"] = serde_json::json!(0);
        challenge["coverage"]["failedPages"]
            .as_array_mut()
            .unwrap()
            .push(
                serde_json::json!({"url":"https://example.kr/a","status":200,"reason":"challenge"}),
            );
        assert!(check(&challenge).is_ok());
        challenge["pageOutcomes"][0]["issue"]["retryAfterMs"] =
            serde_json::json!(9_007_199_254_740_992u64);
        assert_eq!(check(&challenge).unwrap_err(), "detail page issue invalid");
        let mut wrong = detail.clone();
        wrong["coverage"]["checkedPages"] = serde_json::json!(2);
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail page outcomes coverage mismatch"
        );
        wrong = detail.clone();
        wrong["pageOutcomes"][1]["outcome"] = serde_json::json!("checked");
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail page outcome status mismatch"
        );
        wrong = detail.clone();
        wrong["pageOutcomes"][1]["url"] = serde_json::json!("https://example.kr/missing");
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail page outcome missing failed coverage"
        );
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["ocr"]["confidence"] = serde_json::json!(1.1);
        assert_eq!(check(&wrong).unwrap_err(), "detail OCR result invalid");
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["decision"]["passed"] = serde_json::json!("yes");
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail image analysis decision invalid"
        );
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["decision"]["passed"] = serde_json::json!(false);
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail image analysis decision threshold mismatch"
        );
        wrong = detail.clone();
        wrong["imageAnalysis"][0]["decision"]["score"] = serde_json::json!(0.5);
        assert!(check(&wrong).is_ok(), "score at threshold passes");
        wrong["imageAnalysis"][0]["decision"]["score"] = serde_json::json!(0.4);
        wrong["imageAnalysis"][0]["decision"]["passed"] = serde_json::json!(false);
        assert!(check(&wrong).is_ok(), "score below threshold fails");
        wrong = detail.clone();
        wrong["imageAnalysis"] = serde_json::json!(vec![detail["imageAnalysis"][0].clone(); 64]);
        assert!(check(&wrong).is_ok(), "64 image analyses fit the contract");
        wrong["imageAnalysis"]
            .as_array_mut()
            .unwrap()
            .push(detail["imageAnalysis"][0].clone());
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail imageAnalysis exceeds limit"
        );
        wrong = detail.clone();
        wrong["coverage"]["checkedPages"] = serde_json::json!(200);
        wrong["coverage"]["failedPages"] = serde_json::json!([]);
        let outcomes: Vec<_> = (0..200).map(|index| serde_json::json!({
            "url":format!("https://example.kr/{index}"), "finalUrl":format!("https://example.kr/{index}"),
            "status":200,"depth":0,"outcome":"checked"})).collect();
        wrong["pageOutcomes"] = serde_json::json!(outcomes);
        assert!(
            check(&wrong).is_ok(),
            "200 page outcomes reconcile coverage"
        );
        wrong["pageOutcomes"].as_array_mut().unwrap().push(serde_json::json!({
            "url":"https://example.kr/200","finalUrl":"https://example.kr/200","status":200,"depth":0,"outcome":"checked"}));
        wrong["coverage"]["checkedPages"] = serde_json::json!(201);
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail pageOutcomes exceeds limit"
        );
        wrong = detail.clone();
        wrong["findings"][0]["observed"]["selector"] = serde_json::json!("");
        assert_eq!(
            check(&wrong).unwrap_err(),
            "detail f1 observed selector invalid"
        );
        wrong = detail;
        wrong["imageAnalysis"][0]["ocr"] =
            serde_json::json!({"state":"unavailable","backend":"local","reason":"budget"});
        assert!(check(&wrong).is_ok());
    }

    fn good_extra() -> String {
        let official: serde_json::Value = serde_json::from_str(&good_json()).unwrap();
        serde_json::json!({
            "meta": official["meta"],
            "findings": [{
                "id": "x1", "url": "https://example.kr/a", "is_violation": true,
                "location": "https://example.kr/a", "evidence_text": "shared infrastructure",
                "technique": "ETC", "extra_finding": "AD_INFRASTRUCTURE_CORRELATION"
            }]
        })
        .to_string()
    }

    #[test]
    fn accepts_separate_extra_result() {
        assert!(validate_extra_bundle(&good_json(), &good_extra()).is_ok());
    }

    #[test]
    fn rejects_extra_metadata_and_type_mismatch() {
        let mut wrong_time: serde_json::Value = serde_json::from_str(&good_extra()).unwrap();
        wrong_time["meta"]["elapsed_sec"] = serde_json::json!(61);
        assert!(validate_extra_bundle(&good_json(), &wrong_time.to_string()).is_err());
        let mut wrong_type: serde_json::Value = serde_json::from_str(&good_extra()).unwrap();
        wrong_type["findings"][0]["extra_finding"] = serde_json::json!("UNKNOWN");
        assert!(validate_extra_bundle(&good_json(), &wrong_type.to_string()).is_err());
    }

    #[test]
    fn accepts_valid_result() {
        assert!(validate_sidecar_stdout("https://example.kr/", &good_json()).is_ok());
    }

    #[test]
    fn rejects_missing_meta_field() {
        let bad = good_json().replace("\"elapsed_sec\":60,", "");
        assert!(validate_sidecar_stdout("https://example.kr/", &bad).is_err());
    }

    #[test]
    fn rejects_invalid_technique() {
        let bad = good_json().replace("HOMOGLYPH", "ETC");
        let err = validate_sidecar_stdout("https://example.kr/", &bad).unwrap_err();
        assert!(err.contains("technique"), "{err}");
    }

    #[test]
    fn rejects_entry_url_mismatch() {
        let err = validate_sidecar_stdout("https://other.kr/", &good_json()).unwrap_err();
        assert!(err.contains("mismatch"), "{err}");
    }

    #[test]
    fn rejects_duplicate_identity() {
        let v: serde_json::Value = serde_json::from_str(&good_json()).unwrap();
        let mut dup = v.clone();
        let second = v["findings"][0].clone();
        let mut with_id = second.clone();
        with_id["id"] = serde_json::Value::String("f2".to_string());
        dup["findings"].as_array_mut().unwrap().push(with_id);
        let text = serde_json::to_string(&dup).unwrap();
        let err = validate_sidecar_stdout("https://example.kr/", &text).unwrap_err();
        assert!(err.contains("duplicates"), "{err}");
    }

    #[test]
    fn rejects_bom() {
        let bad = format!("\u{FEFF}{}", good_json());
        assert!(validate_sidecar_stdout("https://example.kr/", &bad).is_err());
    }

    #[test]
    fn detail_manifest_must_join_the_official_finding() {
        let detail = serde_json::json!({
            "version": 2,
            "creativeImages": [],
            "findings": [{"findingId":"f1", "url":"https://example.kr/a", "location":"#a",
                "technique":"HOMOGLYPH", "rawText":"x", "visual":{"state":"unavailable","reason":"budget"}}],
            "coverage": {"checkedPages":1,"failedPages":[],"timedOut":false}
        });
        assert!(
            validate_detail_bundle(&good_json(), &detail.to_string(), "{\"findings\":[]}").is_ok()
        );
        let mut partial = detail.clone();
        partial["coverage"]["failedPages"] = serde_json::json!([
            {"url":"https://example.kr/missing-a","status":404,"reason":"HTTP 404"},
            {"url":"https://example.kr/missing-b","status":404,"reason":"HTTP 404"}
        ]);
        assert!(
            validate_detail_bundle(&good_json(), &partial.to_string(), "{\"findings\":[]}").is_ok()
        );
        partial["coverage"]["checkedPages"] = serde_json::json!(-1);
        assert!(
            validate_detail_bundle(&good_json(), &partial.to_string(), "{\"findings\":[]}")
                .is_err()
        );
        let mut wrong = detail;
        wrong["findings"][0]["location"] = serde_json::Value::String("#other".to_string());
        assert!(
            validate_detail_bundle(&good_json(), &wrong.to_string(), "{\"findings\":[]}").is_err()
        );
    }

    #[test]
    fn shares_utf16_policy_rendering_and_timing_boundaries_with_typescript() {
        let corpus: serde_json::Value = serde_json::from_str(include_str!(
            "../../packages/contracts/test/fixtures/detail-policy-conformance.json"
        ))
        .unwrap();
        let check = |value: &serde_json::Value| {
            let mut official: serde_json::Value = serde_json::from_str(&good_json()).unwrap();
            official["findings"][0]["evidence_text"] = value["rawText"].clone();
            let detail = serde_json::json!({"version":2,"findings":[{"findingId":"f1","url":"https://example.kr/a","location":"#a","technique":"HOMOGLYPH",
                "rawText":value["rawText"],"textPolicy":value["textPolicy"],"observed":{"renderingIssues":value["renderingIssues"]},"visual":{"state":"unavailable","reason":"budget"}}],
                "coverage":{"checkedPages":0,"failedPages":[],"timedOut":false},"creativeImages":[],"timing":value["timing"]});
            validate_detail_bundle(
                &official.to_string(),
                &detail.to_string(),
                "{\"findings\":[]}",
            )
        };
        assert!(check(&corpus["valid"]).is_ok());
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
            assert!(check(&value).is_err(), "{}", sample["name"]);
        }
    }
}
