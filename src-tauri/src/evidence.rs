//! Immutable, session-owned evidence index: parse once and transfer selected data.
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};

pub struct SessionEvidence {
    coverage: Value,
    findings: HashMap<String, Value>,
    images: Vec<Value>,
    assets: HashMap<String, Value>,
    summary: Value,
    graph: Value,
}

fn take(object: &mut Value, key: &str) -> Value {
    object.as_object_mut().and_then(|map| map.remove(key)).unwrap_or(Value::Null)
}

fn take_array(object: &mut Value, key: &str) -> Vec<Value> {
    match take(object,key) { Value::Array(items) => items, _ => Vec::new() }
}

fn bounded_integer(query: &Value, key: &str, default: usize, min: usize, max: usize) -> Result<usize, String> {
    let Some(value) = query.get(key) else { return Ok(default); };
    let value = value.as_u64().and_then(|v| usize::try_from(v).ok())
        .filter(|v| *v >= min && *v <= max).ok_or_else(|| format!("{key} must be {min}..={max}"))?;
    Ok(value)
}

pub fn validate_extensions(detail: &Value, extras: &[Value]) -> Result<(), String> {
    let string = |value:&Value|value.as_str().is_some_and(|text|!text.is_empty());
    let strings = |value:&Value|value.as_array().is_some_and(|items|items.iter().all(string));
    let mut asset_ids=HashSet::new();
    let mut characters=0;
    for image in detail["creativeImages"].as_array().into_iter().flatten() {
        characters+=image["dataUrl"].as_str().map_or(0,str::len);
        if let Some(id)=image.get("assetId") {
            if !string(id) || !asset_ids.insert(id.as_str().unwrap()) { return Err("creative asset ID invalid".into()); }
        }
    }
    if let Some(assets)=detail.get("visualAssets") {
        let assets=assets.as_array().ok_or("visual assets must be an array")?;
        if assets.len()>64 { return Err("visual assets exceed limit".into()); }
        for asset in assets {
            let id=asset["assetId"].as_str().filter(|id|!id.is_empty()).ok_or("visual asset ID invalid")?;
            let mime=asset["mimeType"].as_str().ok_or("visual asset MIME invalid")?;
            let data=asset["dataUrl"].as_str().ok_or("visual asset data invalid")?;
            let encoded=data.split_once(',').map(|(_,data)|data).unwrap_or_default();
            let content=encoded.trim_end_matches('=');
            if !asset_ids.insert(id) || !matches!(mime,"image/png"|"image/jpeg"|"image/webp")
                || !data.starts_with(&format!("data:{mime};base64,")) || data.len()>334_000
                || content.is_empty() || encoded.len()-content.len()>2
                || !content.bytes().all(|byte|byte.is_ascii_alphanumeric() || byte==b'+' || byte==b'/') {
                return Err("visual asset representation invalid".into());
            }
            characters+=data.len();
        }
    }
    if characters>2_670_000 { return Err("visual assets exceed capture budget".into()); }
    for image in detail["imageAnalysis"].as_array().into_iter().flatten() {
        if let Some(id)=image.get("assetId") {
            if !id.as_str().is_some_and(|id|asset_ids.contains(id)) { return Err("image asset missing".into()); }
        }
        if image.get("sourceKind").is_some_and(|kind| !matches!(kind.as_str(),Some("img"|"background-image"|"svg"|"canvas")))
            || image.get("visibleDomEquivalent").is_some_and(|value|!value.is_boolean())
            || image.get("candidateEvidence").is_some_and(|value|!strings(value))
            || ["analysisId","frameUrl","location","destinationUrl"].iter().any(|key|image.get(*key).is_some_and(|value|!string(value))) {
            return Err("visual candidate metadata invalid".into());
        }
        if let Some(id)=image.get("extraFindingId") {
            let finding=extras.iter().find(|finding|finding["id"]==*id).ok_or("image-only extra finding missing")?;
            if finding["extra_finding"]!="IMAGE_ONLY_ILLEGAL_AD" || finding["location"]!=image["location"]
                || finding["url"]!=image["frameUrl"] || image["ocr"]["state"]!="available"
                || finding["evidence_text"]!=image["ocr"]["text"] || image["decision"]["passed"]!=true
                || image["visibleDomEquivalent"]!=false || image["matchedTerms"].as_array().is_none_or(Vec::is_empty) {
                return Err("image-only identity invalid".into());
            }
        }
    }
    if let Some(graph)=detail.get("evidenceGraph") {
        let nodes=graph["nodes"].as_array().ok_or("graph nodes missing")?;
        let edges=graph["edges"].as_array().ok_or("graph edges missing")?;
        let mut ids=HashSet::new();
        for node in nodes {
            if !string(&node["id"]) || !node["label"].is_string() || !ids.insert(node["id"].as_str().unwrap())
                || !matches!(node["kind"].as_str(),Some("Page"|"Frame"|"Element"|"Resource"|"Creative"|"Domain"|"Redirect"|"Landing"))
                || node.get("adRelated").is_some_and(|value|!value.is_boolean()) {
                return Err("graph node invalid".into());
            }
        }
        for edge in edges {
            if !edge["from"].as_str().is_some_and(|id|ids.contains(id)) || !edge["to"].as_str().is_some_and(|id|ids.contains(id))
                || !matches!(edge["kind"].as_str(),Some("CONTAINS"|"LOADS"|"EMBEDS"|"DISPLAYS"|"LINKS_TO"|"REDIRECTS_TO"|"SIMILAR_TO"))
                || edge.get("adRelated").is_some_and(|value|!value.is_boolean())
                || edge.get("evidenceKinds").is_some_and(|value|!strings(value)) { return Err("graph edge invalid".into()); }
        }
    }
    if let Some(relations)=detail.get("infrastructure") {
        for relation in relations.as_array().ok_or("infrastructure summary must be an array")? {
            if !string(&relation["domain"]) || !string(&relation["nodeId"]) || !strings(&relation["pageUrls"])
                || relation["pageUrls"].as_array().is_none_or(Vec::is_empty) || !strings(&relation["evidenceKinds"])
                || relation["evidenceKinds"].as_array().is_none_or(Vec::is_empty) { return Err("infrastructure relation invalid".into()); }
        }
    }
    if detail.get("analysisIssues").is_some_and(|value|!strings(value)) { return Err("analysis issues invalid".into()); }
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
                || data.len() > 700_000 || !data.starts_with(&format!("data:{mime};base64,")) {
                return None;
            }
            let mut hash = std::collections::hash_map::DefaultHasher::new();
            data.hash(&mut hash);
            let hash = hash.finish();
            if let Some(ids) = hashes.get(&hash) {
                for id in ids {
                    if assets[id]["dataUrl"] == data { return Some(id.clone()); }
                }
            }
            let id = format!("asset-{}", assets.len() + 1);
            assets.insert(id.clone(), json!({"assetId":id,"mimeType":mime,"dataUrl":data}));
            hashes.entry(hash).or_default().push(id.clone());
            Some(id)
        };
        let mut asset_ids = HashMap::<String, String>::new();
        for mut asset in take_array(&mut detail, "visualAssets") {
            let old_id = asset["assetId"].as_str().unwrap_or_default().to_string();
            let mime = asset["mimeType"].as_str().unwrap_or_default().to_string();
            if let Some(id) = register(take(&mut asset, "dataUrl"), &mime) { asset_ids.insert(old_id, id); }
        }
        let mut findings = HashMap::new();
        for mut finding in take_array(&mut detail, "findings") {
            let id = finding["findingId"].as_str().unwrap_or_default().to_string();
            if let Some(visual) = finding.get_mut("visual") {
                let mime = visual["mimeType"].as_str().unwrap_or("image/jpeg").to_string();
                if let Some(id) = register(take(visual, "dataUrl"), &mime) { visual["assetId"] = json!(id); }
                if let Some(element) = visual.get_mut("element") {
                    if let Some(id) = register(take(element, "dataUrl"), "image/jpeg") { element["assetId"] = json!(id); }
                }
            }
            findings.insert(id, finding);
        }
        let mut creative_images = Vec::new();
        for mut image in take_array(&mut detail, "creativeImages") {
            let mime = image["mimeType"].as_str().unwrap_or_default().to_string();
            if let Some(id) = register(take(&mut image, "dataUrl"), &mime) {
                if let Some(old_id) = image["assetId"].as_str() { asset_ids.insert(old_id.to_string(),id.clone()); }
                image["assetId"] = json!(id);
                creative_images.push(image);
            }
        }
        let mut images = take_array(&mut detail, "imageAnalysis");
        for image in &mut images {
            if let Some(old_id) = image["assetId"].as_str() {
                if let Some(id) = asset_ids.get(old_id) { image["assetId"] = json!(id); }
                else { take(image, "assetId"); }
            }
        }
        let coverage = json!({"coverage":take(&mut detail,"coverage"),
            "pageOutcomes":take_array(&mut detail,"pageOutcomes")});
        let graph_available = detail.get("evidenceGraph").is_some();
        let graph = if graph_available { take(&mut detail,"evidenceGraph") } else { json!({"nodes":[],"edges":[]}) };
        let observed = graph["nodes"].as_array().map_or(0, |nodes| nodes.iter().filter(|n|n["kind"]=="Domain").count());
        let summary = json!({"observedDomainCount":observed,"graphAvailable":graph_available,
            "analysisIssues":take_array(&mut detail,"analysisIssues"),
            "infrastructure":take_array(&mut detail,"infrastructure"),
            "imageAnalysisCount":images.len(),"creativeImages":creative_images});
        Ok(Self {coverage, findings, images, assets, summary, graph})
    }

    pub fn coverage(&self) -> Value { self.coverage.clone() }
    pub fn finding(&self, id: &str) -> Option<Value> { self.findings.get(id).cloned() }
    pub fn asset(&self, id: &str) -> Option<Value> { self.assets.get(id).cloned() }
    pub fn summary(&self) -> Value { self.summary.clone() }

    pub fn images(&self, query: &Value) -> Result<Value, String> {
        let cursor = bounded_integer(query,"cursor",0,0,usize::MAX)?;
        let limit = bounded_integer(query,"limit",12,1,24)?;
        let page = query.get("pageUrl").map(|v|v.as_str().ok_or("pageUrl must be a string")) .transpose()?;
        let finding = query.get("extraFindingId").map(|value|value.as_str().ok_or("extraFindingId must be a string")).transpose()?;
        let items: Vec<_> = self.images.iter().filter(|image| finding.is_none_or(|id|image["extraFindingId"]==id)
            && page.is_none_or(|page|image["pageUrls"].as_array().is_some_and(|urls|urls.iter().any(|url|url==page)))).collect();
        let end = cursor.saturating_add(limit).min(items.len());
        let mut result = json!({"items":items.iter().skip(cursor).take(limit).collect::<Vec<_>>(),"total":items.len()});
        if end < items.len() { result["nextCursor"] = json!(end); }
        Ok(result)
    }

    pub fn graph_slice(&self, query: &Value) -> Result<Value, String> {
        let max_nodes = bounded_integer(query,"maxNodes",100,1,250)?;
        let max_edges = bounded_integer(query,"maxEdges",200,0,500)?;
        let depth = bounded_integer(query,"depth",2,0,2)?;
        let nodes = self.graph["nodes"].as_array().map(Vec::as_slice).unwrap_or(&[]);
        let edges = self.graph["edges"].as_array().map(Vec::as_slice).unwrap_or(&[]);
        let by_id: HashMap<_,_> = nodes.iter().filter_map(|node|node["id"].as_str().map(|id|(id,node))).collect();
        let mut seeds = Vec::new();
        if let Some(focus) = query.get("focus") {
            let kind = focus["kind"].as_str().ok_or("invalid graph focus")?;
            let id = focus["id"].as_str().ok_or("invalid graph focus")?;
            if !matches!(kind,"finding"|"page"|"creative"|"domain") || id.trim().is_empty() { return Err("invalid graph focus".into()); }
            for node in nodes {
                let matched = node["id"] == id || match kind {
                    "finding" => node["findingId"] == id,
                    "page" => node["kind"] == "Page" && (node["url"] == id || node["pageUrl"] == id),
                    "creative" => node["kind"] == "Creative" && node["creativeId"] == id,
                    "domain" => node["kind"] == "Domain" && node["label"] == id,
                    _ => false,
                };
                if matched { if let Some(id) = node["id"].as_str() { seeds.push(id); } }
            }
        } else {
            seeds.extend(nodes.iter().filter(|node|node["adRelated"]==true).filter_map(|node|node["id"].as_str()));
        }
        seeds.sort_unstable();
        let mut adjacency = HashMap::<&str,Vec<&str>>::new();
        for edge in edges {
            if query.get("focus").is_none() && edge["adRelated"] != true { continue; }
            if let (Some(from),Some(to)) = (edge["from"].as_str(),edge["to"].as_str()) {
                if by_id.contains_key(from) && by_id.contains_key(to) {
                    adjacency.entry(from).or_default().push(to);
                    adjacency.entry(to).or_default().push(from);
                }
            }
        }
        for neighbors in adjacency.values_mut() { neighbors.sort_unstable(); neighbors.dedup(); }
        let mut queue: VecDeque<_> = seeds.into_iter().map(|id|(id,0)).collect();
        let mut selected = HashSet::new();
        let mut truncated = false;
        while let Some((id,level)) = queue.pop_front() {
            if selected.contains(id) { continue; }
            if selected.len() == max_nodes { truncated = true; break; }
            selected.insert(id);
            if level < depth {
                for neighbor in adjacency.get(id).into_iter().flatten() { queue.push_back((neighbor,level+1)); }
            }
        }
        let mut selected_nodes: Vec<_> = nodes.iter().filter(|node|node["id"].as_str().is_some_and(|id|selected.contains(id))).collect();
        selected_nodes.sort_by(|a,b|a["id"].as_str().cmp(&b["id"].as_str()));
        let mut selected_edges: Vec<_> = edges.iter().filter(|edge|(query.get("focus").is_some() || edge["adRelated"]==true)
            && edge["from"].as_str().is_some_and(|id|selected.contains(id))
            && edge["to"].as_str().is_some_and(|id|selected.contains(id))).collect();
        selected_edges.sort_by_key(|edge|format!("{}\0{}\0{}",edge["from"].as_str().unwrap_or_default(),edge["to"].as_str().unwrap_or_default(),edge["kind"].as_str().unwrap_or_default()));
        if selected_edges.len() > max_edges { truncated=true; selected_edges.truncate(max_edges); }
        Ok(json!({"nodes":selected_nodes,"edges":selected_edges,"truncated":truncated}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
        assert_eq!(selected["visual"]["assetId"], selected["visual"]["element"]["assetId"]);
        let asset = selected["visual"]["assetId"].as_str().unwrap();
        assert_eq!(index.asset(asset).unwrap()["dataUrl"], "data:image/jpeg;base64,YQ==");
        assert!(index.asset("../../private.txt").is_none());
        assert!(index.finding("f2").is_none());
        assert_eq!(index.coverage()["pageOutcomes"], json!([]));
        assert!(!index.summary().to_string().contains("data:image"));
    }

    #[test]
    fn image_query_pages_metadata_and_never_transfers_images() {
        let index = SessionEvidence::from_json(&json!({"findings":[],"creativeImages":[],
            "imageAnalysis":[{"sourceUrl":"https://a/1","pageUrls":["https://a/"]},
                {"sourceUrl":"https://a/2","pageUrls":["https://b/"]}],
            "coverage":{}}).to_string()).unwrap();
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
        let index = SessionEvidence::from_json(&json!({"findings":[],"creativeImages":[],
            "coverage":{},"evidenceGraph":graph}).to_string()).unwrap();
        let slice = index.graph_slice(&json!({"focus":{"kind":"domain","id":"ads.example"}})).unwrap();
        let ids: Vec<_> = slice["nodes"].as_array().unwrap().iter().map(|n| n["id"].as_str().unwrap()).collect();
        assert_eq!(ids, vec!["d","e","r"]);
        assert_eq!(slice["edges"].as_array().unwrap().len(), 2);
        let capped = index.graph_slice(&json!({"maxNodes":1,"maxEdges":0})).unwrap();
        assert_eq!(capped["nodes"].as_array().unwrap().len(), 1);
        assert_eq!(capped["edges"], json!([]));
        assert_eq!(capped["truncated"], true);
        assert!(index.graph_slice(&json!({"maxNodes":251})).is_err());
        assert!(index.graph_slice(&json!({"maxEdges":501})).is_err());
        assert!(index.graph_slice(&json!({"depth":3})).is_err());
    }
}
