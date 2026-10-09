//! Shipped policy is the same reviewed JSON used by the TS worker and UI.
use serde_json::Value;
use std::sync::OnceLock;

pub fn policy() -> &'static Value {
    static POLICY: OnceLock<Value> = OnceLock::new();
    POLICY.get_or_init(|| {
        let value: Value =
            serde_json::from_str(include_str!("../../packages/contracts/src/policy.json"))
                .expect("shipped policy JSON");
        assert!(
            value["configVersion"] == 1
                && value["detectorPolicyVersion"] == 2
                && value["optionalModels"]["enabled"] == false,
            "unsupported shipped policy"
        );
        value
    })
}

pub fn number(section: &str, key: &str) -> u64 {
    policy()[section][key]
        .as_u64()
        .expect("shipped numeric policy")
}
pub fn scan_limit(input: Option<u64>, key: &str) -> Result<u64, String> {
    let value = input.unwrap_or_else(|| {
        policy()["scan"]["defaults"][key]
            .as_u64()
            .expect("shipped default")
    });
    let bounds = &policy()["scan"]["operatorBounds"][key];
    let min = bounds[0].as_u64().expect("shipped lower bound");
    let max = bounds[1].as_u64().expect("shipped upper bound");
    if value < min || value > max {
        return Err(format!("{key} must be {min}..={max}"));
    }
    Ok(value)
}
