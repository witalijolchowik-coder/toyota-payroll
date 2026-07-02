# Authoritative MVP architecture

## Product definition

The MVP is a smart browser-based workbook for the payroll coordinator, not a general payroll platform. It replaces the current Excel operating workflow with a reliable, collaborative browser application while preserving familiar month-and-employee working patterns.

The application eventually has five business screens:

1. Employees
2. Monthly Settlement
3. Absences
4. Adjustments
5. Reports

None of these business modules is implemented in Step 1.

## System shape

```text
React + Vite static SPA on GitHub Pages
              |
              +-- Firebase Authentication
              +-- Cloud Firestore
              +-- Firebase Storage
              +-- Firebase Cloud Functions
```

There is no traditional application server.

## MVP simplifications

- One `recalculateMonth` Cloud Function will eventually replace the six-stage calculation pipeline.
- Warnings remain inline or on settlement documents; there is no separate `ValidationFinding` lifecycle.
- Import remains preview → coordinator confirmation → apply, without a row subcollection.
- A month uses an `is_settled` flag instead of the full payroll-period lifecycle.
- Operational records keep modification metadata, not a complete audit-log subsystem.
- Default daily hours are virtual UI/calculation values, not stored Firestore facts.

These are implementation-target decisions. The larger enterprise model is retained only as a future additive migration guide.

## Logic boundaries

The browser owns presentation, navigation, low-sensitivity input, reads, uploads, and immediate feedback.

Cloud Functions own multi-document, long-running, and integrity-sensitive work such as recalculation, import apply, and report generation.

Firestore and Storage Security Rules enforce authentication and write boundaries independently of the UI.

## Non-goals for Step 1

- Authentication experience or role management
- Employee register
- Monthly settlement grid or daily entry
- Absence management
- Adjustments
- Import processing
- Reports
- Payroll or time-classification logic
- Business constants in executable code

Step 1 provides only the compilable shell, Firebase boundaries, deployment, and documentation.
