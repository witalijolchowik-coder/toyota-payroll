# Canonical departments and July 2026 assignment migration

## Authoritative registry

Current employee departments are fixed business definitions identified by a
stable ID. Interactive screens use the short UI label; generated business
outputs resolve the official name from the same registry.

| Stable ID         | Official name              | UI label          | Functional group |
| ----------------- | -------------------------- | ----------------- | ---------------- |
| `montaz-toyota`   | `MFG ASSY HL TOYOTA`       | `Montaż Toyota`   | `MONTAZ`         |
| `headliner-bmw`   | `MFG BMW Headliner`        | `Headliner BMW`   | `HEADLINER`      |
| `pu-toyota`       | `MFG PIANY PU Seat Toyota` | `PU Toyota`       | `PU`             |
| `szwalnia-toyota` | `MFG Toyota Cover`         | `Szwalnia Toyota` | `SZWALNIA`       |
| `metal-402b`      | `MFG Toyota Metal 402B`    | `Metal 402B`      | `METAL`          |
| `metal-936b`      | `MFG Toyota Metal 936B`    | `Metal 936B`      | `METAL`          |
| `magazyn`         | `PC REC. ASSY TOY`         | `Magazyn`         | `MAGAZYN`        |

The functional group preserves existing qualification rules. Both Metal lines
remain separate departments but resolve to `METAL`. Medical examination types
remain: `METAL`, `MONTAZ`, `SZWALNIA` → production; `MAGAZYN` → warehouse;
`HEADLINER`, `PU` → HL/PU production.

## July source reconciliation

`PS - przydział 07.2026` is authoritative for current department assignment.
The July daily balance supplies TETA. Matching normalizes case, whitespace,
Polish diacritics and unambiguous first-name/surname order, then uses TETA as
the employee identity.

The preview classifies unchanged and changed existing employees, missing
employees, identical duplicates, conflicts, unresolved TETA, explicit
exclusions, balance-only people and ambiguous legacy Metal. Only safe changed,
new and one-to-one legacy rows can be applied. Repeating the operation does not
recreate employees or rewrite already-correct assignments.

Missing employees are created as incomplete employee master records. No
contract, employment date, shift, citizenship, identity document,
accommodation or medical fact is inferred. Without contract coverage they do
not participate in a payroll month.

Special rules:

- Dmytro Karpets keeps TETA `WT-07832507` and is assigned to `metal-936b`;
- Marek Maślany and Robert Wojtaluk use their balance TETA and are assigned to
  `headliner-bmw`;
- Vitalii Olkhovyk is deliberately excluded from workforce imports and is not
  reported as unresolved.

## Legacy compatibility

The old `Montaż`, `Headliner`, `PU`, `Szwalnia` and `Magazyn` values are accepted
only as one-to-one migration aliases. Generic `Metal` is never guessed because
it can mean either 402B or 936B. It requires the authoritative source assignment
or a coordinator decision. Old and temporary labels are not selectable for new
edits.

Current employee master data and effective-dated assignment history receive
the stable department ID. Locked historical settlement snapshots are not
rewritten. New calculations and formal exports resolve the official name;
interactive tables resolve the UI label.

## Audit and security

Applied employee changes write source-specific audit metadata containing TETA,
previous/target department IDs and both canonical labels. Summary audit records
counts for duplicates, conflicts, unresolved rows, exclusions and ambiguous
legacy Metal without storing uploaded spreadsheets. Existing approved-user
access remains in force. Firestore Rules only extend the department correction
allowlist to the seven stable IDs.
