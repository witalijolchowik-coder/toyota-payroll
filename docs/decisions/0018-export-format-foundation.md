# ADR 0018: Export format foundation

## Status

Accepted for Block 12.

## Context

The monthly settlement must produce practical external files:

- one Toyota-specific Excel report;
- two SOZ CSV files split into PL and foreign worker groups;
- a mandatory SOZ note when overtime covers `niedoczas` / private time.

The project does not yet store PESEL/passport identity data and does not yet
have a final Toyota `.xlsx` workbook template.

## Decision

Implement export foundation as pure TypeScript mapping helpers plus a
client-side export panel in the Monthly Settlement area.

The helpers:

- preserve the template-derived SOZ 138-column order;
- generate UTF-8 BOM semicolon CSV files;
- split SOZ rows by identity-document rule when identity data exists;
- warn instead of guessing when identity data is missing;
- generate an accompanying overtime/niedoczas note;
- generate an Excel-compatible Toyota spreadsheet from the same monthly draft
  data.

No export history is persisted in Firestore in this block.

## Consequences

- No Firestore rules change is needed.
- Exports can be generated from the current reviewed monthly draft without
  creating production data.
- SOZ output is structurally ready, but real PL/foreign membership needs a
  future employee identity-data extension.
- The Toyota export can be opened by Excel, but exact `.xlsx` styling remains a
  future template-hardening task.
