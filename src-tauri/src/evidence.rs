//! Immutable, session-owned evidence index: parse once and transfer selected data.
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SessionEvidence {
    coverage: Value,
    findings: HashMap<String, Value>,
    images: Vec<Value>,
    assets: HashMap<String, Value>,
    summary: Value,
    graph: Value,
    #[serde(skip)]
    asset_root: Option<std::path::PathBuf>,
}

pub fn is_image_bytes(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.starts_with(b"\xff\xd8\xff")
        || (bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"))
}

fn take(object: &mut Value, key: &str) -> Value {
    object
        .as_object_mut()
        .and_then(|map| map.remove(key))
        .unwrap_or(Value::Null)
}

fn take_array(object: &mut Value, key: &str) -> Vec<Value> {
    match take(object, key) {
        Value::Array(items) => items,
        _ => Vec::new(),
    }
}

fn bounded_integer(
    query: &Value,
    key: &str,
    default: usize,
    min: usize,
    max: usize,
) -> Result<usize, String> {
    let Some(value) = query.get(key) else {
        return Ok(default);
    };
    let value = value
        .as_u64()
        .and_then(|v| usize::try_from(v).ok())
        .filter(|v| *v >= min && *v <= max)
        .ok_or_else(|| format!("{key} must be {min}..={max}"))?;
    Ok(value)
}

fn valid_text_embedding(value: &Value) -> bool {
    if value["state"] == "unavailable" {
        return matches!(value["reason"].as_str(), Some("budget" | "model-error" | "invalid-input"));
    }
    let cosine = |key: &str| value[key].as_f64().filter(|n| n.is_finite() && (-1.0..=1.0).contains(n));
    let (Some(positive), Some(negative), Some(margin), Some(elapsed)) =
        (cosine("positiveSimilarity"), cosine("negativeSimilarity"), value["margin"].as_f64(), value["elapsedMs"].as_f64()) else { return false; };
    value["state"] == "available" && matches!(value["policy"].as_str(), Some("text-ad-embedding-v1" | "text-ad-embedding-v2" | "text-ad-embedding-v3"))
        && (value["model"] == "embeddinggemma-2-text-f32" || (value["model"] == "embeddinggemma-2-text-int8" && value["policy"] == "text-ad-embedding-v3"))
        && value["revision"] == "daa72c51243991dfcaf9f9137d2c573d8f7790c0"
        && margin.is_finite() && (margin - (positive - negative)).abs() <= 1e-6
        && value["threshold"].as_f64() == Some(0.0)
        && value["passed"].as_bool() == Some(margin >= 0.0)
        && elapsed.is_finite() && (0.0..=8000.0).contains(&elapsed)
}

fn valid_text_review(image: &Value) -> bool {
    if image["decision"]["score"].as_f64() != Some(3.0) || image["decision"]["threshold"].as_f64() != Some(3.0)
        || image["decision"]["passed"] != true || !valid_text_embedding(&image["textEmbedding"]) || image["textEmbedding"]["state"] != "available"
        || image["textEmbedding"]["passed"] != true || image["ocr"]["state"] != "available"
        || !image["ocr"]["text"].as_str().is_some_and(|text| !text.trim().is_empty() && text.encode_utf16().count() <= 4096)
        || image["visibleDomEquivalent"] != false
        || !image["candidateEvidence"].as_array().is_some_and(|items| items.iter().any(|item| item == "external-destination")) {
        return false;
    }
    let (Some(destination), Some(page)) = (image["destinationUrl"].as_str(), image["frameUrl"].as_str()) else { return false; };
    let (Ok(destination), Ok(page)) = (url::Url::parse(destination), url::Url::parse(page)) else { return false; };
    matches!(destination.scheme(), "http" | "https") && destination.host_str().is_some()
        && destination.username().is_empty() && destination.password().is_none()
        && matches!(page.scheme(), "http" | "https") && page.host_str().is_some()
        && destination.host_str() != page.host_str()
}

fn valid_visual_embedding(value: &Value) -> bool {
    if value["state"] == "unavailable" { return matches!(value["reason"].as_str(), Some("budget" | "model-error" | "invalid-input")); }
    let cosine = |key: &str| value[key].as_f64().filter(|n| n.is_finite() && (-1.0..=1.0).contains(n));
    let (Some(p),Some(n),Some(m),Some(sp),Some(sn),Some(sm),Some(elapsed)) =
        (cosine("positiveSimilarity"),cosine("negativeSimilarity"),value["margin"].as_f64(),cosine("shuffledPositiveSimilarity"),cosine("shuffledNegativeSimilarity"),value["shuffledMargin"].as_f64(),value["elapsedMs"].as_f64()) else { return false; };
    value["state"] == "available" && matches!(value["policy"].as_str(),Some("image-ad-embedding-v1" | "image-ad-embedding-v2" | "image-ad-embedding-v3")) && (value["model"] == "embeddinggemma-2-image-text-f32" || (matches!(value["model"].as_str(), Some("embeddinggemma-2-image-text-int8" | "embeddinggemma-2-image-text-f32-vision-int8")) && value["policy"] == "image-ad-embedding-v3"))
        && value["revision"] == "daa72c51243991dfcaf9f9137d2c573d8f7790c0"
        && value["imageSha256"].as_str().is_some_and(|s| s.len()==64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)))
        && m.is_finite() && sm.is_finite() && (m-(p-n)).abs()<=1e-6 && (sm-(sp-sn)).abs()<=1e-6
        && value["threshold"].as_f64()==Some(0.0) && value["control"]=="pixel-shuffle-v1" && value["seed"]==1701
        && value["passed"].as_bool()==Some(m>=0.0 && sm<0.0) && elapsed.is_finite() && (0.0..=16000.0).contains(&elapsed)
}

fn valid_visual_review(image: &Value) -> bool {
    let value=&image["visualEmbedding"];
    if image["decision"]["score"].as_f64()!=Some(3.0) || image["decision"]["threshold"].as_f64()!=Some(3.0)
        || image["decision"]["passed"]!=true || !valid_visual_embedding(value) || value["state"]!="available" || value["passed"]!=true
        || image["assetId"].as_str()!=value["imageSha256"].as_str().map(|s|format!("visual-{s}")).as_deref()
        || image["ocr"]["state"]!="available" || !image["ocr"]["text"].as_str().is_some_and(|s|s.encode_utf16().count()<=4096)
        || image["visibleDomEquivalent"]!=false || !image["candidateEvidence"].as_array().is_some_and(|a|a.iter().any(|v|v=="external-destination")) { return false; }
    let (Some(target),Some(page))=(image["destinationUrl"].as_str(),image["frameUrl"].as_str()) else {return false;};
    let (Ok(target),Ok(page))=(url::Url::parse(target),url::Url::parse(page)) else {return false;};
    matches!(target.scheme(),"http"|"https") && target.host_str().is_some() && target.username().is_empty() && target.password().is_none()
        && matches!(page.scheme(),"http"|"https") && page.host_str().is_some() && target.host_str()!=page.host_str()
}

pub fn validate_extensions(detail: &Value, extras: &[Value]) -> Result<(), String> {
    let string = |value: &Value| value.as_str().is_some_and(|text| !text.is_empty());
    let strings = |value: &Value| {
        value
            .as_array()
            .is_some_and(|items| items.iter().all(string))
    };
    let mut asset_ids = HashSet::new();
    let mut characters = 0;
    for image in detail["creativeImages"].as_array().into_iter().flatten() {
        characters += image["dataUrl"].as_str().map_or(0, str::len);
        if let Some(id) = image
            .get("assetId")
            .filter(|_| image.get("dataUrl").is_some())
        {
            if !string(id) || !asset_ids.insert(id.as_str().unwrap()) {
                return Err("creative asset ID invalid".into());
            }
        }
    }
    if let Some(assets) = detail.get("visualAssets") {
        let assets = assets.as_array().ok_or("visual assets must be an array")?;
        if assets.len() > 64 {
            return Err("visual assets exceed limit".into());
        }
        for asset in assets {
            let id = asset["assetId"]
                .as_str()
                .filter(|id| !id.is_empty())
                .ok_or("visual asset ID invalid")?;
            let mime = asset["mimeType"]
                .as_str()
                .ok_or("visual asset MIME invalid")?;
            let data = asset["dataUrl"]
                .as_str()
                .ok_or("visual asset data invalid")?;
            let encoded = data
                .split_once(',')
                .map(|(_, data)| data)
                .unwrap_or_default();
            let content = encoded.trim_end_matches('=');
            if !asset_ids.insert(id)
                || !matches!(mime, "image/png" | "image/jpeg" | "image/webp")
                || !data.starts_with(&format!("data:{mime};base64,"))
                || data.len() > 700_000
                || content.is_empty()
                || encoded.len() - content.len() > 2
                || !content
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/')
            {
                return Err("visual asset representation invalid".into());
            }
            characters += data.len();
        }
    }
    if characters > 5_340_000 {
        return Err("visual assets exceed capture budget".into());
    }
    for image in detail["imageAnalysis"].as_array().into_iter().flatten() {
        if let Some(alternatives) = image.get("ocrAlternatives") {
            let valid = alternatives.as_array().is_some_and(|items| items.len() <= 1 && items.iter().all(|item| {
                item["backend"].as_str().is_some_and(|s| !s.is_empty() && s.encode_utf16().count() <= 128)
                    && if item["state"] == "available" {
                        item["text"].as_str().is_some_and(|s| s.encode_utf16().count() <= 4096)
                            && item["confidence"].as_f64().is_some_and(|n| n.is_finite() && (0.0..=1.0).contains(&n))
                    } else { item["state"] == "unavailable" && matches!(item["reason"].as_str(), Some("budget" | "recognition-error")) }
            }));
            if !valid { return Err("OCR alternatives invalid".into()); }
        }

        if image.get("visualEmbedding").is_some_and(|v| !valid_visual_embedding(v)) { return Err("image embedding evidence invalid".into()); }
        if image["visualEmbedding"]["state"]=="available" && image["assetId"].as_str()!=image["visualEmbedding"]["imageSha256"].as_str().map(|s|format!("visual-{s}")).as_deref() { return Err("image embedding asset mismatch".into()); }
        if image["decision"]["rule"]=="image-only-ad-v5-image-review" && !valid_visual_review(image) { return Err("image embedding review invalid".into()); }
        if image.get("textEmbedding").is_some_and(|value| !valid_text_embedding(value)) {
            return Err("text embedding evidence invalid".into());
        }
        if image["decision"]["rule"] == "image-only-ad-v4-text-review" && !valid_text_review(image) {
            return Err("text embedding review invalid".into());
        }
        if let Some(frame) = image.get("animationFrame") {
            if frame["index"].as_u64().is_none_or(|value| value >= crate::config::number("visual", "animationFrames"))
                || frame["timestampMs"].as_f64().is_none_or(|value| !value.is_finite() || !(0.0..=86_400_000.0).contains(&value)) {
                return Err("animation frame invalid".into());
            }
        }
        if let Some(id) = image.get("assetId") {
            if !id.as_str().is_some_and(|id| asset_ids.contains(id)) {
                return Err("image asset missing".into());
            }
        }
        if image.get("sourceKind").is_some_and(|kind| {
            !matches!(
                kind.as_str(),
                Some("img" | "background-image" | "svg" | "canvas")
            )
        }) || image
            .get("visibleDomEquivalent")
            .is_some_and(|value| !value.is_boolean())
            || image
                .get("candidateEvidence")
                .is_some_and(|value| !strings(value))
            || ["analysisId", "frameUrl", "location", "destinationUrl"]
                .iter()
                .any(|key| image.get(*key).is_some_and(|value| !string(value)))
        {
            return Err("visual candidate metadata invalid".into());
        }
        if let Some(id) = image.get("extraFindingId") {
            let finding = extras
                .iter()
                .find(|finding| finding["id"] == *id)
                .ok_or("image-only extra finding missing")?;
            if finding["extra_finding"] != "IMAGE_ONLY_ILLEGAL_AD"
                || finding["location"] != image["location"]
                || finding["url"] != image["frameUrl"]
                || image["ocr"]["state"] != "available"
                || finding["evidence_text"] != image["ocr"]["text"]
                || image["decision"]["passed"] != true
                || image["visibleDomEquivalent"] != false
                || (image["matchedTerms"].as_array().is_none_or(Vec::is_empty)
                    && !(image["decision"]["rule"] == "image-only-ad-v4-text-review" && valid_text_review(image))
                    && !(image["decision"]["rule"] == "image-only-ad-v5-image-review" && valid_visual_review(image)))
            {
                return Err("image-only identity invalid".into());
            }
        }
    }
    if let Some(graph) = detail.get("evidenceGraph") {
        let nodes = graph["nodes"].as_array().ok_or("graph nodes missing")?;
        let edges = graph["edges"].as_array().ok_or("graph edges missing")?;
        let mut ids = HashSet::new();
        for node in nodes {
            if !string(&node["id"])
                || !node["label"].is_string()
                || !ids.insert(node["id"].as_str().unwrap())
                || !matches!(
                    node["kind"].as_str(),
                    Some(
                        "Page"
                            | "Frame"
                            | "Element"
                            | "Resource"
                            | "Creative"
                            | "Domain"
                            | "Redirect"
                            | "Landing"
                    )
                )
                || node
                    .get("adRelated")
                    .is_some_and(|value| !value.is_boolean())
            {
                return Err("graph node invalid".into());
            }
        }
        for edge in edges {
            if !edge["from"].as_str().is_some_and(|id| ids.contains(id))
                || !edge["to"].as_str().is_some_and(|id| ids.contains(id))
                || !matches!(
                    edge["kind"].as_str(),
                    Some(
                        "CONTAINS"
                            | "LOADS"
                            | "EMBEDS"
                            | "DISPLAYS"
                            | "LINKS_TO"
                            | "REDIRECTS_TO"
                            | "SIMILAR_TO"
                    )
                )
                || edge
                    .get("adRelated")
                    .is_some_and(|value| !value.is_boolean())
                || edge
                    .get("evidenceKinds")
                    .is_some_and(|value| !strings(value))
            {
                return Err("graph edge invalid".into());
            }
        }
    }
    if let Some(relations) = detail.get("infrastructure") {
        for relation in relations
            .as_array()
            .ok_or("infrastructure summary must be an array")?
        {
            if !string(&relation["domain"])
                || !string(&relation["nodeId"])
                || !strings(&relation["pageUrls"])
                || relation["pageUrls"].as_array().is_none_or(Vec::is_empty)
                || !strings(&relation["evidenceKinds"])
                || relation["evidenceKinds"]
                    .as_array()
                    .is_none_or(Vec::is_empty)
            {
                return Err("infrastructure relation invalid".into());
            }
        }
    }
    if detail
        .get("analysisIssues")
        .is_some_and(|value| !strings(value))
    {
        return Err("analysis issues invalid".into());
    }
    if let Some(c) = detail.get("visualAnalysisCoverage") {
        if let Some(s) = c.get("selection") {
            if !s["policy"].as_str().is_some_and(|s| !s.is_empty())
                || [
                    ("retainedRecords", 64),
                    ("retainedAssets", 40),
                    ("retainedBytes", 2_000_000),
                    ("excludedRecords", 9_007_199_254_740_991),
                ]
                .iter()
                .any(|(k, max)| !s[*k].as_u64().is_some_and(|v| v <= *max))
                || s["ocrSha256"].as_array().is_none_or(|hashes| {
                    let mut seen = HashSet::new();
                    hashes.len() as u64 > crate::config::number("visual", "ocrImages")
                        || hashes.iter().any(|h| {
                            h.as_str().is_none_or(|h| {
                                h.len() != 64
                                    || !h.bytes().all(|b| b.is_ascii_hexdigit())
                                    || !seen.insert(h)
                            })
                        })
                })
            {
                return Err("visual selection invalid".into());
            }
        }
        let number = |key: &str| {
            c[key]
                .as_u64()
                .filter(|value| *value <= 9_007_199_254_740_991)
        };
        let counts = [
            "pagesConsidered",
            "pagesNotConsidered",
            "candidatesObserved",
            "imagesAcquired",
            "imageAnalysisRecords",
            "ocrImagesAttempted",
            "ocrImagesCompleted",
            "ocrImagesUnavailable",
        ];
        let limit_keys = [
            "pages",
            "candidatesPerDocument",
            "elementsPerDocument",
            "bytesPerPage",
            "distinctOcrImages",
        ];
        let limits = [
            "page-limit",
            "candidate-limit",
            "element-limit",
            "byte-limit",
            "ocr-image-limit",
            "deadline",
        ];
        let frames_per_candidate = c["limits"].get("framesPerCandidate").map_or(Some(1), Value::as_u64);
        let reasons = [
            "page-limit",
            "candidate-limit",
            "element-limit",
            "byte-limit",
            "ocr-image-limit",
            "deadline",
            "cancelled",
            "capture-error",
            "document-unavailable",
            "image-unavailable",
            "target-unavailable",
        ];
        if frames_per_candidate.is_none_or(|value| value == 0 || value > crate::config::number("visual", "framesPerCandidate"))
            || counts.iter().any(|key| number(key).is_none())
            || c.get("candidateTotal") != Some(&Value::Null)
            || limit_keys.iter().any(|key| {
                c["limits"][*key]
                    .as_u64()
                    .is_none_or(|value| value == 0 || value > 9_007_199_254_740_991)
            })
            || c["limitsReached"].as_array().is_none_or(|items| {
                let mut seen = HashSet::new();
                items.iter().any(|value| {
                    value
                        .as_str()
                        .is_none_or(|value| !limits.contains(&value) || !seen.insert(value))
                })
            })
            || c["skips"].as_array().is_none_or(|items| {
                items.iter().any(|skip| {
                    skip["reason"]
                        .as_str()
                        .is_none_or(|value| !reasons.contains(&value))
                        || !matches!(
                            skip["unit"].as_str(),
                            Some("page" | "document" | "candidate" | "image")
                        )
                        || skip["count"]
                            .as_u64()
                            .is_none_or(|value| value == 0 || value > 9_007_199_254_740_991)
                })
            })
        {
            return Err("visual analysis coverage invalid".into());
        }
        if number("pagesConsidered").unwrap() > c["limits"]["pages"].as_u64().unwrap()
            || number("imagesAcquired").unwrap() as u128 > number("candidatesObserved").unwrap() as u128 * frames_per_candidate.unwrap() as u128
            || number("imageAnalysisRecords") > number("imagesAcquired")
            || number("ocrImagesAttempted") > number("imageAnalysisRecords")
            || number("ocrImagesAttempted").unwrap()
                > c["limits"]["distinctOcrImages"].as_u64().unwrap()
            || number("ocrImagesCompleted").unwrap() + number("ocrImagesUnavailable").unwrap()
                != number("ocrImagesAttempted").unwrap()
        {
            return Err("visual analysis coverage counts inconsistent".into());
        }
    }
    Ok(())
}

impl SessionEvidence {
    pub fn from_json(text: &str) -> Result<Self, String> {
        let mut detail: Value = serde_json::from_str(text).map_err(|error| error.to_string())?;
        let mut assets = HashMap::<String, Value>::new();
        let mut hashes = HashMap::<u64, Vec<String>>::new();
        let mut register = |data: Value, mime: &str| -> Option<String> {
            let data = data.as_str()?;
            if !matches!(mime, "image/jpeg" | "image/png" | "image/webp")
                || data.len() > 700_000
                || !data.starts_with(&format!("data:{mime};base64,"))
            {
                return None;
            }
            let mut hash = std::collections::hash_map::DefaultHasher::new();
            data.hash(&mut hash);
            let hash = hash.finish();
            if let Some(ids) = hashes.get(&hash) {
                for id in ids {
                    if assets[id]["dataUrl"] == data {
                        return Some(id.clone());
                    }
                }
            }
            let id = format!("asset-{}", assets.len() + 1);
            assets.insert(
                id.clone(),
                json!({"assetId":id,"mimeType":mime,"dataUrl":data}),
            );
            hashes.entry(hash).or_default().push(id.clone());
            Some(id)
        };
        let mut asset_ids = HashMap::<String, String>::new();
        for mut asset in take_array(&mut detail, "visualAssets") {
            let old_id = asset["assetId"].as_str().unwrap_or_default().to_string();
            let mime = asset["mimeType"].as_str().unwrap_or_default().to_string();
            if let Some(id) = register(take(&mut asset, "dataUrl"), &mime) {
                asset_ids.insert(old_id, id);
            }
        }
        let mut findings = HashMap::new();
        for mut finding in take_array(&mut detail, "findings") {
            let id = finding["findingId"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            if let Some(visual) = finding.get_mut("visual") {
                if let Some(old_id) = visual["assetId"].as_str().map(str::to_string) {
                    if let Some(id) = asset_ids.get(&old_id) {
                        visual["assetId"] = json!(id);
                    }
                }
                let mime = visual["mimeType"]
                    .as_str()
                    .unwrap_or("image/jpeg")
                    .to_string();
                if let Some(id) = register(take(visual, "dataUrl"), &mime) {
                    visual["assetId"] = json!(id);
                }
                if let Some(element) = visual.get_mut("element") {
                    if let Some(old_id) = element["assetId"].as_str().map(str::to_string) {
                        if let Some(id) = asset_ids.get(&old_id) {
                            element["assetId"] = json!(id);
                        }
                    }
                    if let Some(id) = register(take(element, "dataUrl"), "image/jpeg") {
                        element["assetId"] = json!(id);
                    }
                }
            }
            findings.insert(id, finding);
        }
        let mut creative_images = Vec::new();
        for mut image in take_array(&mut detail, "creativeImages") {
            let mime = image["mimeType"].as_str().unwrap_or_default().to_string();
            if let Some(id) = register(take(&mut image, "dataUrl"), &mime) {
                if let Some(old_id) = image["assetId"].as_str() {
                    asset_ids.insert(old_id.to_string(), id.clone());
                }
                image["assetId"] = json!(id);
                creative_images.push(image);
            } else if let Some(id) = image["assetId"]
                .as_str()
                .and_then(|id| asset_ids.get(id))
                .cloned()
            {
                image["assetId"] = json!(id);
                creative_images.push(image);
            }
        }
        let mut images = take_array(&mut detail, "imageAnalysis");
        for image in &mut images {
            if let Some(old_id) = image["assetId"].as_str() {
                if let Some(id) = asset_ids.get(old_id) {
                    image["assetId"] = json!(id);
                } else {
                    take(image, "assetId");
                }
            }
        }
        let coverage = json!({"coverage":take(&mut detail,"coverage"),
            "pageOutcomes":take_array(&mut detail,"pageOutcomes")});
        let graph_available = detail.get("evidenceGraph").is_some();
        let graph = if graph_available {
            take(&mut detail, "evidenceGraph")
        } else {
            json!({"nodes":[],"edges":[]})
        };
        let observed = graph["nodes"].as_array().map_or(0, |nodes| {
            nodes.iter().filter(|n| n["kind"] == "Domain").count()
        });
        let mut summary = json!({"observedDomainCount":observed,"graphAvailable":graph_available,
            "analysisIssues":take_array(&mut detail,"analysisIssues"),
            "infrastructure":take_array(&mut detail,"infrastructure"),
            "imageAnalysisCount":images.len(),"creativeImages":creative_images});
        if detail.get("visualAnalysisCoverage").is_some() {
            summary["visualAnalysisCoverage"] = take(&mut detail, "visualAnalysisCoverage");
        }
        if detail.get("timing").is_some() {
            summary["timing"] = take(&mut detail, "timing");
        }
        Ok(Self {
            coverage,
            findings,
            images,
            assets,
            summary,
            graph,
            asset_root: None,
        })
    }

    pub fn coverage(&self) -> Value {
        self.coverage.clone()
    }
    pub fn finding(&self, id: &str) -> Option<Value> {
        self.findings.get(id).cloned()
    }
    pub fn asset(&self, id: &str) -> Option<Value> {
        use base64::Engine;
        let asset = self.assets.get(id)?;
        if let Some(root) = &self.asset_root {
            let root_metadata = std::fs::symlink_metadata(root).ok()?;
            if !root_metadata.is_dir() || crate::case_store::is_link(&root_metadata) {
                return None;
            }
            let hash = asset["sha256"].as_str()?;
            if hash.len() != 64 || !hash.bytes().all(|c| c.is_ascii_hexdigit()) {
                return None;
            }
            let path = root.join(hash);
            let metadata = std::fs::symlink_metadata(&path).ok()?;
            if !metadata.is_file()
                || crate::case_store::is_link(&metadata)
                || metadata.len() > 525_000
            {
                return None;
            }
            let bytes = crate::case_store::read_bounded(&path, 525_000).ok()?;
            if crate::case_store::digest(&bytes) != hash || !is_image_bytes(&bytes) {
                return None;
            }
            let mime = asset["mimeType"].as_str()?;
            if !matches!(mime, "image/png" | "image/jpeg" | "image/webp") {
                return None;
            }
            return Some(
                json!({"assetId":id,"mimeType":mime,"dataUrl":format!("data:{mime};base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes))}),
            );
        }
        Some(asset.clone())
    }

    /// Store shared bytes once; persisted metadata contains only opaque IDs.
    pub fn persist(&mut self, directory: &std::path::Path) -> Result<(), String> {
        use base64::Engine;
        let root = directory.join("assets");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        for asset in self.assets.values_mut() {
            let mime = asset["mimeType"]
                .as_str()
                .ok_or("asset MIME missing")?
                .to_string();
            let data = asset["dataUrl"].as_str().ok_or("asset data missing")?;
            let encoded = data.split_once(',').ok_or("asset data invalid")?.1;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .map_err(|e| e.to_string())?;
            if bytes.len() > 525_000 || !is_image_bytes(&bytes) {
                return Err("asset is not a supported bounded image".into());
            }
            let hash = crate::case_store::digest(&bytes);
            let path = root.join(&hash);
            if !path.exists() {
                crate::case_store::write_new(&path, &bytes)?;
            }
            *asset = json!({"assetId":asset["assetId"],"mimeType":mime,"sha256":hash,"bytes":bytes.len()});
        }
        self.asset_root = Some(root);
        let bytes = serde_json::to_vec(self).map_err(|e| e.to_string())?;
        if bytes.len() > 8_000_000 {
            return Err("evidence index exceeds limit".into());
        }
        crate::case_store::write_new(&directory.join("evidence.json"), &bytes)
    }

    pub fn reopen(
        directory: &std::path::Path,
        official: &str,
        extra: Option<&str>,
    ) -> Result<Self, String> {
        let bytes = crate::case_store::read_bounded(&directory.join("evidence.json"), 8_000_000)?;
        let mut index: Self = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        index.asset_root = Some(directory.join("assets"));
        // Reconstruct the public bundle and apply the same trust-boundary validator.
        // Asset data is bounded and loaded once per unique ID, never once per finding.
        let mut assets = Vec::new();
        if index.assets.len() > 64 {
            return Err("evidence asset count exceeds limit".into());
        }
        for id in index.assets.keys() {
            assets.push(
                index
                    .asset(id)
                    .ok_or("evidence asset unavailable or corrupt")?,
            );
        }
        let parsed: Value = serde_json::from_str(official).map_err(|e| e.to_string())?;
        let empty_extra = json!({"meta":parsed["meta"],"findings":[]}).to_string();
        let mut bundle = json!({"version":2,"findings":index.findings.values().collect::<Vec<_>>(),"coverage":index.coverage["coverage"],"pageOutcomes":index.coverage["pageOutcomes"],"imageAnalysis":index.images,"creativeImages":index.summary["creativeImages"],"visualAssets":assets,"evidenceGraph":index.graph,"analysisIssues":index.summary["analysisIssues"],"infrastructure":index.summary["infrastructure"]});
        if let Some(value) = index.summary.get("visualAnalysisCoverage") {
            bundle["visualAnalysisCoverage"] = value.clone();
        }
        if let Some(value) = index.summary.get("timing") {
            bundle["timing"] = value.clone();
        }
        crate::validation::validate_detail_bundle(
            official,
            &bundle.to_string(),
            extra.unwrap_or(&empty_extra),
        )?;
        Ok(index)
    }
    pub fn summary(&self) -> Value {
        self.summary.clone()
    }

    pub fn images(&self, query: &Value) -> Result<Value, String> {
        let cursor = bounded_integer(query, "cursor", 0, 0, usize::MAX)?;
        let limit = bounded_integer(query, "limit", 12, 1, 24)?;
        let page = query
            .get("pageUrl")
            .map(|v| v.as_str().ok_or("pageUrl must be a string"))
            .transpose()?;
        let finding = query
            .get("extraFindingId")
            .map(|value| value.as_str().ok_or("extraFindingId must be a string"))
            .transpose()?;
        let items: Vec<_> = self
            .images
            .iter()
            .filter(|image| {
                finding.is_none_or(|id| image["extraFindingId"] == id)
                    && page.is_none_or(|page| {
                        image["pageUrls"]
                            .as_array()
                            .is_some_and(|urls| urls.iter().any(|url| url == page))
                    })
            })
            .collect();
        let end = cursor.saturating_add(limit).min(items.len());
        let mut result = json!({"items":items.iter().skip(cursor).take(limit).collect::<Vec<_>>(),"total":items.len()});
        if end < items.len() {
            result["nextCursor"] = json!(end);
        }
        Ok(result)
    }

    pub fn graph_slice(&self, query: &Value) -> Result<Value, String> {
        let max_nodes = bounded_integer(query, "maxNodes", 100, 1, 250)?;
        let max_edges = bounded_integer(query, "maxEdges", 200, 0, 500)?;
        let depth = bounded_integer(query, "depth", 2, 0, 2)?;
        let nodes = self.graph["nodes"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let edges = self.graph["edges"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let by_id: HashMap<_, _> = nodes
            .iter()
            .filter_map(|node| node["id"].as_str().map(|id| (id, node)))
            .collect();
        let mut seeds = Vec::new();
        if let Some(focus) = query.get("focus") {
            let kind = focus["kind"].as_str().ok_or("invalid graph focus")?;
            let id = focus["id"].as_str().ok_or("invalid graph focus")?;
            if !matches!(kind, "finding" | "page" | "creative" | "domain") || id.trim().is_empty() {
                return Err("invalid graph focus".into());
            }
            for node in nodes {
                let matched = node["id"] == id
                    || match kind {
                        "finding" => node["findingId"] == id,
                        "page" => {
                            node["kind"] == "Page" && (node["url"] == id || node["pageUrl"] == id)
                        }
                        "creative" => node["kind"] == "Creative" && node["creativeId"] == id,
                        "domain" => node["kind"] == "Domain" && node["label"] == id,
                        _ => false,
                    };
                if matched {
                    if let Some(id) = node["id"].as_str() {
                        seeds.push(id);
                    }
                }
            }
        } else {
            seeds.extend(
                nodes
                    .iter()
                    .filter(|node| node["adRelated"] == true)
                    .filter_map(|node| node["id"].as_str()),
            );
        }
        seeds.sort_unstable();
        let mut adjacency = HashMap::<&str, Vec<&str>>::new();
        for edge in edges {
            if query.get("focus").is_none() && edge["adRelated"] != true {
                continue;
            }
            if let (Some(from), Some(to)) = (edge["from"].as_str(), edge["to"].as_str()) {
                if by_id.contains_key(from) && by_id.contains_key(to) {
                    adjacency.entry(from).or_default().push(to);
                    adjacency.entry(to).or_default().push(from);
                }
            }
        }
        for neighbors in adjacency.values_mut() {
            neighbors.sort_unstable();
            neighbors.dedup();
        }
        let mut queue: VecDeque<_> = seeds.into_iter().map(|id| (id, 0)).collect();
        let mut selected = HashSet::new();
        let mut truncated = self.graph["truncated"] == true;
        while let Some((id, level)) = queue.pop_front() {
            if selected.contains(id) {
                continue;
            }
            if selected.len() == max_nodes {
                truncated = true;
                break;
            }
            selected.insert(id);
            if level < depth {
                for neighbor in adjacency.get(id).into_iter().flatten() {
                    queue.push_back((neighbor, level + 1));
                }
            }
        }
        let mut selected_nodes: Vec<_> = nodes
            .iter()
            .filter(|node| node["id"].as_str().is_some_and(|id| selected.contains(id)))
            .collect();
        selected_nodes.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));
        let mut selected_edges: Vec<_> = edges
            .iter()
            .filter(|edge| {
                (query.get("focus").is_some() || edge["adRelated"] == true)
                    && edge["from"]
                        .as_str()
                        .is_some_and(|id| selected.contains(id))
                    && edge["to"].as_str().is_some_and(|id| selected.contains(id))
            })
            .collect();
        selected_edges.sort_by_key(|edge| {
            format!(
                "{}\0{}\0{}",
                edge["from"].as_str().unwrap_or_default(),
                edge["to"].as_str().unwrap_or_default(),
                edge["kind"].as_str().unwrap_or_default()
            )
        });
        if selected_edges.len() > max_edges {
            truncated = true;
            selected_edges.truncate(max_edges);
        }
        Ok(json!({"nodes":selected_nodes,"edges":selected_edges,"truncated":truncated}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn measured_visual_coverage_survives_selected_reads_and_rejects_invented_totals() {
        let coverage = json!({"pagesConsidered":8,"pagesNotConsidered":1,"candidatesObserved":7,
            "candidateTotal":null,"imagesAcquired":7,"imageAnalysisRecords":7,
            "ocrImagesAttempted":6,"ocrImagesCompleted":5,"ocrImagesUnavailable":1,
            "limits":{"pages":8,"candidatesPerDocument":8,"elementsPerDocument":10000,"bytesPerPage":250000,"distinctOcrImages":6},
            "limitsReached":["page-limit","ocr-image-limit"],
            "skips":[{"reason":"page-limit","unit":"page","count":1},{"reason":"ocr-image-limit","unit":"image","count":1}]});
        let detail = json!({"findings":[],"creativeImages":[],"coverage":{},"visualAnalysisCoverage":coverage});
        assert!(validate_extensions(&detail, &[]).is_ok());
        let index = SessionEvidence::from_json(&detail.to_string()).unwrap();
        assert_eq!(index.summary()["visualAnalysisCoverage"], coverage);
        for (key, value) in [
            ("candidateTotal", 50),
            ("pagesConsidered", 9),
            ("ocrImagesCompleted", 7),
            ("ocrImagesAttempted", 7),
            ("imagesAcquired", 8),
        ] {
            let mut invalid = detail.clone();
            invalid["visualAnalysisCoverage"][key] = json!(value);
            assert!(
                validate_extensions(&invalid, &[]).is_err(),
                "accepted {key}"
            );
        }
        let mut animated = detail.clone();
        animated["visualAnalysisCoverage"]["limits"]["framesPerCandidate"] = json!(4);
        animated["visualAnalysisCoverage"]["imagesAcquired"] = json!(28);
        assert!(validate_extensions(&animated, &[]).is_ok());
        animated["visualAnalysisCoverage"]["imagesAcquired"] = json!(29);
        assert!(validate_extensions(&animated, &[]).is_err());
        animated["visualAnalysisCoverage"]["imagesAcquired"] = json!(7);
        for invalid in [json!(0), json!(5), Value::Null] {
            animated["visualAnalysisCoverage"]["limits"]["framesPerCandidate"] = invalid;
            assert!(validate_extensions(&animated, &[]).is_err());
        }
    }

    #[test]
    fn text_review_requires_consistent_scores_and_observed_external_ocr_without_fabricated_terms() {
        let embedding = json!({"state":"available","policy":"text-ad-embedding-v1","model":"embeddinggemma-2-text-f32",
            "revision":"daa72c51243991dfcaf9f9137d2c573d8f7790c0","positiveSimilarity":0.6,"negativeSimilarity":0.4,
            "margin":0.2,"threshold":0,"passed":true,"elapsedMs":100});
        let detail = json!({"imageAnalysis":[{"textEmbedding":embedding,"frameUrl":"https://site.example/", "location":"#banner",
            "destinationUrl":"https://advertiser.example/join","candidateEvidence":["external-destination"],
            "visibleDomEquivalent":false,"matchedTerms":[],"extraFindingId":"x1",
            "ocr":{"state":"available","text":"actual OCR"},"decision":{"rule":"image-only-ad-v4-text-review","score":3,"threshold":3,"passed":true}}]});
        let extras = [json!({"id":"x1","extra_finding":"IMAGE_ONLY_ILLEGAL_AD","url":"https://site.example/","location":"#banner","evidence_text":"actual OCR"})];
        assert!(validate_extensions(&detail, &extras).is_ok());
        let mut education_policy = detail.clone();
        education_policy["imageAnalysis"][0]["textEmbedding"]["policy"] = json!("text-ad-embedding-v2");
        assert!(validate_extensions(&education_policy, &extras).is_ok());
        education_policy["imageAnalysis"][0]["textEmbedding"]["policy"] = json!("text-ad-embedding-v3");
        education_policy["imageAnalysis"][0]["textEmbedding"]["model"] = json!("embeddinggemma-2-text-int8");
        assert!(validate_extensions(&education_policy, &extras).is_ok());
        for (key, value) in [("margin", json!(0.3)), ("positiveSimilarity", json!(1.1)),
            ("passed", json!(false)), ("policy", json!("unknown")), ("model", json!("other")), ("revision", json!("main")),
            ("elapsedMs", json!(8001)), ("threshold", json!(0.05))] {
            let mut invalid = detail.clone(); invalid["imageAnalysis"][0]["textEmbedding"][key] = value;
            assert!(validate_extensions(&invalid, &extras).is_err(), "accepted forged {key}");
        }
        for (key, value) in [("destinationUrl", json!("https://user:secret@advertiser.example/")),
            ("destinationUrl", json!("javascript:alert(1)")), ("destinationUrl", json!("https://site.example/join")),
            ("candidateEvidence", json!([])), ("visibleDomEquivalent", json!(true)),
            ("decision", json!({"rule":"image-only-ad-v4-text-review","score":0.2,"threshold":0,"passed":true})),
            ("textEmbedding", json!({"state":"unavailable","reason":"budget"})),
            ("ocr", json!({"state":"available","text":" "})),
            ("ocr", json!({"state":"available","text":"x".repeat(4097)}))] {
            let mut invalid = detail.clone(); invalid["imageAnalysis"][0][key] = value;
            assert!(validate_extensions(&invalid, &extras).is_err(), "accepted missing review boundary {key}");
        }
        let mut legacy = detail.clone(); legacy["imageAnalysis"][0]["decision"]["rule"] = json!("image-only-ad-v3");
        assert!(validate_extensions(&legacy, &extras).is_err());
        for reason in ["budget", "model-error", "invalid-input"] {
            assert!(valid_text_embedding(&json!({"state":"unavailable","reason":reason})));
        }
        assert!(!valid_text_embedding(&json!({"state":"unavailable","reason":"other"})));
    }

    #[test]
    fn animation_frame_metadata_is_bounded_and_legacy_images_remain_valid() {
        let mut detail = json!({"imageAnalysis":[{}]});
        assert!(validate_extensions(&detail, &[]).is_ok());
        detail["imageAnalysis"][0]["animationFrame"] = json!({"index":119,"timestampMs":40});
        assert!(validate_extensions(&detail, &[]).is_ok());
        for invalid in [Value::Null, json!({"index":120,"timestampMs":40}),
            json!({"index":-1,"timestampMs":40}), json!({"index":1,"timestampMs":-1})] {
            detail["imageAnalysis"][0]["animationFrame"] = invalid;
            assert!(validate_extensions(&detail, &[]).is_err());
        }
    }

    #[test]
    fn selected_detail_contains_only_opaque_assets_and_legacy_data_is_lazy() {
        let detail = json!({"coverage":{"checkedPages":1,"failedPages":[],"timedOut":false},
            "findings":[{"findingId":"f1","rawText":"ad", "visual":{"state":"available",
                "mimeType":"image/jpeg","dataUrl":"data:image/jpeg;base64,YQ==",
                "element":{"state":"available","mimeType":"image/jpeg","dataUrl":"data:image/jpeg;base64,YQ=="}}}],
            "creativeImages":[],"imageAnalysis":[]});
        let index = SessionEvidence::from_json(&detail.to_string()).unwrap();
        let selected = index.finding("f1").unwrap();
        assert!(!selected.to_string().contains("data:image"));
        assert_eq!(
            selected["visual"]["assetId"],
            selected["visual"]["element"]["assetId"]
        );
        let asset = selected["visual"]["assetId"].as_str().unwrap();
        assert_eq!(
            index.asset(asset).unwrap()["dataUrl"],
            "data:image/jpeg;base64,YQ=="
        );
        assert!(index.asset("../../private.txt").is_none());
        assert!(index.finding("f2").is_none());
        assert_eq!(index.coverage()["pageOutcomes"], json!([]));
        assert!(!index.summary().to_string().contains("data:image"));
    }

    #[test]
    fn image_query_pages_metadata_and_never_transfers_images() {
        let index = SessionEvidence::from_json(
            &json!({"findings":[],"creativeImages":[],
            "imageAnalysis":[{"sourceUrl":"https://a/1","pageUrls":["https://a/"]},
                {"sourceUrl":"https://a/2","pageUrls":["https://b/"]}],
            "coverage":{}})
            .to_string(),
        )
        .unwrap();
        assert_eq!(index.images(&json!({"limit":1})).unwrap()["nextCursor"], 1);
        let filtered = index.images(&json!({"pageUrl":"https://b/"})).unwrap();
        assert_eq!(filtered["total"], 1);
        assert_eq!(filtered["items"][0]["sourceUrl"], "https://a/2");
        assert!(index.images(&json!({"limit":25})).is_err());
        assert!(index.images(&json!({"cursor":-1})).is_err());
    }

    #[test]
    fn graph_slice_honors_depth_and_endpoint_caps_without_loading_assets() {
        let graph = json!({"nodes":[
            {"id":"d","kind":"Domain","label":"ads.example","adRelated":true},
            {"id":"r","kind":"Resource","label":"creative","adRelated":true},
            {"id":"e","kind":"Element","label":"ad","findingId":"f1","adRelated":true},
            {"id":"p","kind":"Page","label":"page","pageUrl":"https://a/","adRelated":true},
            {"id":"cdn","kind":"Domain","label":"cdn.example"}],
            "edges":[{"from":"e","to":"r","kind":"LOADS","adRelated":true},
                {"from":"r","to":"d","kind":"LINKS_TO","adRelated":true},
                {"from":"p","to":"e","kind":"CONTAINS","adRelated":true}]});
        let index = SessionEvidence::from_json(
            &json!({"findings":[],"creativeImages":[],
            "coverage":{},"evidenceGraph":graph})
            .to_string(),
        )
        .unwrap();
        let slice = index
            .graph_slice(&json!({"focus":{"kind":"domain","id":"ads.example"}}))
            .unwrap();
        let ids: Vec<_> = slice["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| n["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["d", "e", "r"]);
        assert_eq!(slice["edges"].as_array().unwrap().len(), 2);
        let capped = index
            .graph_slice(&json!({"maxNodes":1,"maxEdges":0}))
            .unwrap();
        assert_eq!(capped["nodes"].as_array().unwrap().len(), 1);
        assert_eq!(capped["edges"], json!([]));
        assert_eq!(capped["truncated"], true);
        assert!(index.graph_slice(&json!({"maxNodes":251})).is_err());
        assert!(index.graph_slice(&json!({"maxEdges":501})).is_err());
        assert!(index.graph_slice(&json!({"depth":3})).is_err());
    }
    #[test]
    fn independent_ocr_alternatives_are_bounded_and_optional() {
        let mut detail = json!({"imageAnalysis":[{"ocrAlternatives":[{"state":"available","backend":"small-banner","text":"40%15%","confidence":0.8}]}]});
        assert!(validate_extensions(&detail, &[]).is_ok());
        for invalid in [json!([{"state":"available","backend":"cpu","text":"x".repeat(4097),"confidence":0.8}]),
            json!([{"state":"available","backend":"cpu","text":"raw","confidence":1.1}]),
            json!([{"state":"unavailable","backend":"cpu","reason":"other"}]), json!(false)] {
            detail["imageAnalysis"][0]["ocrAlternatives"] = invalid;
            assert!(validate_extensions(&detail, &[]).is_err());
        }
        detail["imageAnalysis"][0]["ocrAlternatives"] = json!([{"state":"unavailable","backend":"small-banner","reason":"budget"}]);
        assert!(validate_extensions(&detail, &[]).is_ok());
    }

    #[test]
    fn pixel_review_requires_bound_asset_and_layout_control_without_fabricated_words() {
        let embedding=json!({"state":"available","policy":"image-ad-embedding-v1","model":"embeddinggemma-2-image-text-f32","revision":"daa72c51243991dfcaf9f9137d2c573d8f7790c0","imageSha256":"a".repeat(64),"positiveSimilarity":0.8,"negativeSimilarity":0.7,"margin":0.1,"shuffledPositiveSimilarity":0.6,"shuffledNegativeSimilarity":0.7,"shuffledMargin":-0.1,"threshold":0,"control":"pixel-shuffle-v1","seed":1701,"passed":true,"elapsedMs":9000});
        let image=json!({"assetId":format!("visual-{}","a".repeat(64)),"visualEmbedding":embedding,"frameUrl":"https://site.example/","destinationUrl":"https://offer.example/","candidateEvidence":["external-destination"],"visibleDomEquivalent":false,"ocr":{"state":"available","text":"7474 30+10"},"decision":{"rule":"image-only-ad-v5-image-review","score":3,"threshold":3,"passed":true}});
        assert!(valid_visual_review(&image));
        let mut revised=image.clone();revised["visualEmbedding"]["policy"]=json!("image-ad-embedding-v2");assert!(valid_visual_review(&revised));
        revised["visualEmbedding"]["policy"]=json!("image-ad-embedding-v3");assert!(valid_visual_review(&revised));
        revised["visualEmbedding"]["model"]=json!("embeddinggemma-2-image-text-int8");assert!(valid_visual_review(&revised));
        revised["visualEmbedding"]["model"]=json!("embeddinggemma-2-image-text-f32-vision-int8");assert!(valid_visual_review(&revised));
        revised["visualEmbedding"]["policy"]=json!("image-ad-embedding-v2");assert!(!valid_visual_review(&revised));
        for (key,value) in [("shuffledMargin",json!(0.1)),("elapsedMs",json!(16001)),("passed",json!(false)),("imageSha256",json!("invalid"))] {
            let mut invalid=image.clone();invalid["visualEmbedding"][key]=value;assert!(!valid_visual_review(&invalid));
        }
        let mut invalid=image.clone();invalid["assetId"]=json!("visual-wrong");assert!(!valid_visual_review(&invalid));
        invalid=image.clone();invalid["destinationUrl"]=json!("https://user:secret@offer.example/");assert!(!valid_visual_review(&invalid));
    }

}
