# Stage 2 dynamic recalculation risk report

This report records the remaining risks for the later closing and snapshot
stage. It does not change the behaviour of closed months.

## Current dynamic inputs

- attendance values and manual work-time corrections;
- planned schedule and public-holiday classification;
- active absence records, including NI overtime time off;
- employment contracts and employee entitlements;
- effective payroll settings and their validity ranges;
- manual adjustments and accommodation assignments.

Changing any of these inputs can recalculate an open month, including overtime
allocation, calculated GN, frequency bonus, SOZ values, NOTATKA, and Absencja
exports.

## Remaining closing risks

- An open historical month can still change when a source document is edited.
- Allocation is deterministic but currently recalculated rather than stored as
  an authoritative monthly snapshot.
- Legacy records are normalized at read time; no background migration pins the
  normalized result.
- Export files are reproducible from current inputs, but their hashes and
  allocation details are not persisted as a closing artifact.
- Cross-client edits can race before a month is closed because allocation is
  calculated in the client.

## Required later-stage controls

- Persist a versioned month calculation snapshot and the input revision used.
- Store authoritative overtime allocations and export metadata at closing.
- Reject stale writes using calculation version or transaction preconditions.
- Keep closed snapshots immutable and require an explicit reopen workflow.
- Record audit entries for close, reopen, regeneration, and superseding export
  artifacts.
