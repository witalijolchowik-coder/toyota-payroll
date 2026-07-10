# ADR 0017: Monthly Settlement Review States

## Status

Accepted.

## Context

Monthly Settlement now produces rich in-memory draft data, warnings and
component summaries. Coordinators need a practical workflow to review each
employee-month before future export or closing, without turning the draft into a
final payroll snapshot.

## Decision

Persist employee-month review state under the month:

```text
/months/{monthId}/reviewStates/{employeeId}
```

Supported statuses:

- `DRAFT`;
- `NEEDS_REVIEW`;
- `NEEDS_CORRECTION`;
- `CHECKED`.

The document stores employee reference fields, review note, reviewed actor/time
and standard modification metadata.

## Consequences

- Review state is scoped to the month and can be protected by the existing
  `is_settled` month lock.
- Review does not duplicate employee names.
- Review data does not affect settlement calculation functions.
- Future payroll closing can use the readiness helper as an input, but must
  still implement its own immutable snapshot/export mechanism.
