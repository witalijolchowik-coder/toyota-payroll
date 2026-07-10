# ADR 0013: Departments, color shifts and rotation foundation

## Status

Accepted.

## Context

The Calendar Constructor needs practical employee filtering by department and
Red/White/Blue shift assignment. Future payroll and planning stages also need a
clear distinction between an employee's stable color shift and the actual
working shift produced by weekly rotation.

## Decision

Introduce an editable `/departments` reference collection and store stable
references on employee documents:

```text
employees/{employeeId}.department_id
employees/{employeeId}.shift_assignment
```

`shift_assignment` is limited to:

- `RED`
- `WHITE`
- `BLUE`
- `null`

Department documents store:

```text
name
shift_mode
active
created_at / created_by / updated_at / updated_by
```

`shift_mode` is limited to:

- `UNKNOWN`
- `TWO_SHIFT`
- `THREE_SHIFT`

Weekly rotation is represented for now by pure TypeScript helper types. No
rotation documents or scheduler UI are introduced in this block.

## Consequences

- Employees can be managed and filtered by department and color shift.
- Operational payroll documents continue to reference employees only by
  `employee_id` and `teta_number`.
- Payroll-month participation remains based on employment-period overlap, not
  department, color shift or current active status.
- Future rotation and planning work can extend the reference model without
  changing the existing employee identity model.
