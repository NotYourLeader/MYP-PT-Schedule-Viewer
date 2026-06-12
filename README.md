# MYP PT Schedule — Data-Driven Viewer

A static, GitHub Pages-ready schedule viewer for MYP Progress Tests. All operational data lives in CSV files in `/data` — update the schedule by editing CSVs only. No build step, no backend, no framework.

## File structure

```
index.html          ← layout containers only (no schedule rows)
css/styles.css      ← all styling (extracted from original viewer)
js/app.js           ← CSV loading, parsing, and rendering
data/
  sessions.csv      ← SOURCE OF TRUTH: all testing sessions
  cover.csv         ← cover, release, room moves, displacement notes
  leadership.csv    ← session leaders / mobile leaders by period
  adjustments.csv   ← moved / cancelled / confirmed schedule changes
  concurrent.csv    ← concurrency counts by day/period
  changelog.csv     ← visible Change Log tab content
  meta.json         ← title, version, published date, description
README.md
```

## Deploying to GitHub Pages

1. Create a repository and upload **everything** in this folder (keep the folder structure exactly as-is).
2. In the repo: **Settings → Pages → Source: Deploy from a branch → main → / (root)**.
3. Done. All paths are relative, so it works from the repo root or a project subpath.

## Local preview

Browsers block `fetch()` over `file://`, so don't double-click `index.html`. Use any local HTTP server:

- **VS Code:** install the *Live Server* extension → right-click `index.html` → "Open with Live Server"
- **Python:** `python3 -m http.server 8000` then open http://localhost:8000
- **Node:** `npx serve`

## Making schedule changes (the whole point)

| You want to… | Edit this file |
|---|---|
| Add / move / cancel a testing session | `data/sessions.csv` |
| Add a cover, release, or room-move note | `data/cover.csv` |
| Change a session leader / mobile leader | `data/leadership.csv` |
| Record a MOVED / CANCELLED adjustment | `data/adjustments.csv` |
| Update concurrency counts | `data/concurrent.csv` |
| Add a visible change-log entry | `data/changelog.csv` |
| Change the title / version / banner text | `data/meta.json` |

Commit the CSV edit, push, and GitHub Pages updates automatically. **Never edit `index.html` for schedule changes.**

### CSV conventions

- Fields containing commas must be wrapped in double quotes: `"P1 CONNECTED, P3 MATH"`.
- A literal double quote inside a quoted field is doubled: `""`.
- `status` column values: `active`, `cancelled` (red strikethrough), `rescheduled` (green moved highlight).
- `date_iso` (YYYY-MM-DD) drives sorting and the past-day collapse; `date` (e.g. `Tue 16 Jun`) is the display label.
- `reprint_codes`: `YES` shows the REPRINT badge.
- In `cover.csv`, `risk` values: `normal`, `amber`, `red` (RED highlight), `cancelled`.
- To add a new test day, add its ISO date to `DATE_ORDER` and `DAY_LABEL` in `js/app.js` (the one structural edit you may ever need).

## Display rules preserved from the original viewer

- **Timeline is the default landing tab.** Past days are grouped under a collapsed "Past days" section; the current day is highlighted.
- **Session leaders are NOT classroom teachers.** Leaders/mobile leaders render in period headings and the Leadership tab. The session card keeps the teacher/cover/supervision notes from `sessions.csv`. No staff rows imply a leader is teaching a class unless the data says they supervise/cover it.
- P6 is lunch and blocked from schedule blocks; a break band sits between P3 and P4.
- Class and teacher views are printable/exportable via the Print/Export buttons.
- Cancelled sessions show in red strikethrough; moved sessions in green.

## Key represented changes (v2.6)

- **Tue 16 P8 — 8C.PTEBOTH:** Saeed Smith covers/starts P8 (replacing Rob/mobile cover); Sarum supervises P9–P10.
- **Wed 17 P7 — 8E.PTM2:** Saeed covers Sarum and starts the session at P7; David Barton finishes P8.
- **7C.PTS:** confirmed on Wed 24 P4–P5 only (Uchenna starts P4, Liam continues P5). The stale Fri 19 P2–P3 entry exists only as a MOVED-from record in adjustments.

## Limitations & assumptions

- The CSV parser handles quoted fields and escaped quotes but not multi-line fields — keep each record on one line.
- `concurrent.csv` is maintained by hand (matching the original viewer); it is not auto-derived from `sessions.csv`.
- The "today" marker is fixed in `js/app.js` (`TODAY_ISO`); update it if you want a different focus day, or swap in `new Date()` logic.
- Teacher views are derived by name-matching across `sessions.csv`, `cover.csv`, and `leadership.csv`, so spell names consistently across files.
