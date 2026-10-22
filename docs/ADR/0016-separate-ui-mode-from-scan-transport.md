# ADR-0016: Separate presentation mode from scan scope and transport

Status: accepted for initial scope (ordinary direct, two UI modes, single-case infrastructure). Date: 2026-10-20.

## Context

The user requests simple/advanced screen and workflow design without runtime
code changes, ordinary inspection without mandatory app WARP, and an explicit
existing/additional-development boundary for infrastructure analysis.
The contest workflow starts with a public website URL and locates advertisements
inside its pages; infrastructure analysis extends this workflow.

At the design baseline the native scan launcher always added --require-warp. The worker already
has direct and tunnel execution paths, but UI requests do not select transport.
TransportProvenance's existing direct reasons are owned-origin and source-cli;
neither accurately labels an ordinary public-site scan from the UI.
InfrastructureRelation is session-scoped and stores domain/pageUrls/evidenceKinds.
Bounded graph reads and per-session workbook summaries exist. Cross-case
infrastructure aggregation and durable batch-group restoration do not.

## Decision

Propose two presentations over one detector, case store and review writer.
Simple mode defaults to URL inspection, concise progress, evidence/review and
XLSX reporting. Advanced mode adds detailed scope, batch work, technical evidence
and list-first infrastructure analysis. Shared official exports remain reachable
from both modes. Presentation does not change detection policy or case identity.

New scans default to the current PC network without an app-owned tunnel.
WARP is explicitly selected in advanced connection settings for one scan or
batch; registration alone never starts scanning. No automatic registration,
direct-to-WARP retry or WARP-to-direct failover is proposed. Each retry that
changes transport creates a new case and retains the original observation.
Public-IP authorization/pinning, TLS validation, deadlines and child ownership
must apply to both paths. PC-wide network settings are unchanged.

First infrastructure delivery reuses stored single-case summaries/graphs.
Role labels require actual graph witnesses. Cross-case selection/aggregation,
batch identity restoration, comparison exports and extra-finding reviews are
separate development. Active external discovery is outside initial delivery.

Screen details live in SCREEN_SPEC.md and flows in UX_FLOW.md. This proposed
decision revises the mandatory app-WARP direction in the 2026-10-14 transport
design when implemented; its network and credential boundaries remain relevant.
ADR-0010's shared application and ADR-0015's immutable official files and
separate review revisions remain applicable.

## Alternatives considered

- One dense screen with folded settings: insufficient for the reported mixing
  of routine review, technical analysis, exports and connection setup.
- Two independent apps or detector backends: duplicates state and risks different
  output for the same scan. No separate algorithm is needed for presentation.
- Remove URL inspection and discover infrastructure globally: loses the required
  evaluator input and needs a separate collection source and discovery scope.
- Mandatory WARP or automatic failover: couples ordinary inspection to external
  enrollment and changes the observation's network conditions without selection.
- Full graph as the starting screen: hides concrete domains and source evidence
  behind navigation that routine operators do not need.

## Costs and consequences

This needs coordinated request/host/worker/provenance/import-validator changes;
hiding WARP UI or dropping one launch flag alone is insufficient. Old cases must
remain readable without rewriting their transport or official bytes. Mode
preference is new local application state; case reviews remain case-owned.
Cross-case analysis needs bounded metadata reads and explicit unavailable/truncated
states. Optional evidence limits can undercount observed infrastructure; counts
are never a census or evidence of ownership. Role derivation is additional work.

## Invalidation

Revisit if an actual evaluation/network requirement mandates a tunnel, if a
receiving organization requires managed network configuration, or if measured
case volume makes bounded on-demand aggregation insufficient. Obtain that
requirement before introducing a background index, server or continuous crawler.

## Verification

OBSERVED design inputs: native launcher, worker, ScanRequest/HostBridge,
TransportProvenance, InfrastructureRelation/EvidenceSummary, graph summaries,
ScanResult/EvidenceRelations, CaseReviewWriter and report-data/report exporter.
Source implementation and fresh execution evidence are tracked in ADOPTION_LEDGER.md. NOT_RUN: latest Windows package/native screenshots and user study. Cross-case aggregation and active discovery are deferred.
Acceptance scenarios and delivery order are in SCREEN_SPEC.md's dated proposal.
