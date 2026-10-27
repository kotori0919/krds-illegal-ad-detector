import policy from "../../packages/contracts/src/policy.json" with { type: "json" };

// Build metadata identifies the detector policy, independently of Case schema.
export const buildPolicyIdentity = Object.freeze({
  caseSchemaVersion: 1,
  detectorPolicyVersion: policy.detectorPolicyVersion,
});
