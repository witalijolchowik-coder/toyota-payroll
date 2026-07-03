# ADR 0010: Versioned payroll settings and monthly adjustments

## Status

Accepted

## Context

Global payroll amounts need historical validity, while employee adjustments
are independent monthly coordinator facts. Settled payroll periods must not
change when configuration evolves.

## Decision

- Store global versions in `/payrollSettings`.
- Use payroll month IDs for inclusive validity boundaries.
- Keep versions append-only and resolve the latest matching `valid_from`.
- Represent accommodation types as variants of
  `accommodation_allowance`.
- Reuse `/months/{monthId}/adjustments` for employee facts.
- Replace generic code/unit adjustment fields with the approved category,
  direction, amount, note, and lifecycle model.
- Cancel adjustments instead of deleting them.
- Keep both modules behind existing authenticated repository and audit
  metadata boundaries.

## Consequences

Historical setting versions remain readable and deterministic. New setting
types can use another `setting_key` without schema changes. Accommodation
assignment and all payroll calculations remain deferred.

Settings history protection is enforced by the service and append-only
Security Rules. A future trusted server boundary should make the
settled-history preflight authoritative under concurrent writes.
