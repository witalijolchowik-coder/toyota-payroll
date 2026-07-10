# ADR 0018: Export format foundation

## Status

Accepted for Block 12.

## Context

The monthly settlement must produce practical external files:

- one Toyota-specific Excel report;
- two SOZ CSV files split into PL and foreign worker groups;
- a mandatory SOZ note when overtime covers `niedoczas` / private time.

The project did not yet store PESEL/passport identity data and does not yet have
a final Toyota `.xlsx` workbook template.

## Decision

Implement export foundation as pure TypeScript mapping helpers plus a
client-side export panel in the Monthly Settlement area.

Add optional, backward-compatible employee identity fields required for SOZ
split correctness:

- `pesel`;
- `passport_number`;
- `foreign_document_number`.

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

- Firestore employee rules allow optional identity fields without requiring
  existing documents to be migrated immediately.
- Exports can be generated from the current reviewed monthly draft without
  creating production data.
- SOZ output can split employees once PESEL/passport fields are filled; missing
  identity data remains visible as a readiness warning.
- The Toyota export can be opened by Excel, but exact `.xlsx` styling remains a
  future template-hardening task.
