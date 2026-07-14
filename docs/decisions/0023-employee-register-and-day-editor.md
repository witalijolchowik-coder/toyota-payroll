# Employee register and day editor interaction

## Employee register

- The default operational mode is `Aktywni`; `Archiwum` contains employees whose final employment end date is before today. An absence never moves an employee to the archive.
- The employee name is the primary row label. TETA remains the business identifier but uses normal visual weight.
- Approved departments use stable labelled chips. Shift groups use compact `Red`, `White`, and `Blue` chips; color is supplementary to text.
- The employment column shows `first Toyota employment / current contract start` for active employees and `first Toyota employment / final cooperation end` in the archive.
- Sortable columns preserve search and list mode. Employee sorting uses surname then first name. Department sorting follows the canonical order: Metal, Szwalnia, Montaż, PU, Headliner, Magazyn. Shift sorting always uses department first and shift second.

## Monthly calendar

- Clicking an employee name opens the personal monthly calendar.
- In `Przegląd`, clicking a day opens the shared one-day editor. When a range tool is active, the same click selects a range instead.
- Both the common grid and personal calendar use the same editor and save flow.
- The editor separates `Godziny` from `Nieobecność`. Planned hours and the date-effective shift provide the default context; actual hours never overwrite the planned schedule.
- Work-time deviation is derived with the existing overtime/private-time helpers. Exact night classification requires the actual interval; no additional overtime rules are introduced here.
- Manual L4 is stored as a manual one-day L4 and therefore remains `Zgłoszone` until confirmed by a ZUS import.
- Confirmed imported L4 and original imported attendance remain protected from replacement in this generic editor.
- Replacing a manual absence or manual hours requires explicit confirmation. Changes write audit entries with employee reference, date, previous/new business value, actor, and timestamp.
- The bulk constructor remains available; its leave-on-demand label is `UŻ`.
