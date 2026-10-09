# ADR-0015: Commit official results independently and retain versioned cases

Status: accepted. Date: 2026-10-09.

## Context

The current adoption goal supersedes internal v0 freeze assumptions in ADR-0003.
Native export currently requires valid detail and extra files and loses registry
state after restart. Review notes have no durable owner. Historical results and
the official four-technique contract must remain immutable.

## Decision

Keep official contract v0; identify corrected output with tool 0.2.0 / policy 2.
Use a native file CaseStore schema 1 with same-volume staged commit. Official
validation and storage are mandatory; evidence and extras degrade independently
with recorded issues. The registry is a cache of saved cases. Operator review
uses optimistic revision checks in a separate file. Portable directory transfer
is allowlisted, bounded and never executes captured content. Future schemas fail
closed; no destructive downgrade or implicit rescan.

## Alternatives considered

- One all-or-nothing bundle: rejected because optional failure loses valid work.
- Database/server: rejected because local case files meet the present need.
- Rewrite historical JSON with new rules: rejected because evidence is immutable.

## Costs and consequences

Native storage/IPC needs conformance tests. Atomic rename is not proof of power
loss durability. Missing optional files remain visible and cannot be regenerated
without explicit new capture. Update/rollback preserves schema1 and case root.

## Invalidation

Concurrent multi-user case editing or a demonstrated volume limit may justify a
different store. Official schema changes require actual supplied rule evidence.

## Verification

Tracked in ADOPTION_LEDGER.md: restart, optional faults, strict rejection,
revision conflict, safe transfer, shared assets and unchanged official bytes.
