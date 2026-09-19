# ACCOUNTANT — Owner verdict

**Verdict: TOO_MUCH**

**Intent:** AR/AP + Tally + amounts/budget/profit + `bill.approve` + projects **view**. No project editing, no estimate approve, no `settings.users`, no procurement PO approve. Projects tab OK.

**Sources:** `DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT`, live `/auth/me` + probes (`accounts@reddyconst.com` / OTP `111111`, Owner `owner@reddyconst.com`).

**Live catalog:** 20 perms — exact match to defaults (`invoice.*`, `bill.*` incl. approve, `tally.export`, `financials.view_amounts|budget|profit`, `project.view`, petty cash, labor wage settle, reports, `settings.tickets`). Correctly lacks `project.edit/create`, `estimate.approve`, `settings.users`, `procurement.approve_po`.

---

## Decision table

| Area | Verdict | Evidence |
|------|---------|----------|
| **AR/AP (invoice + bill)** | **APPROVE** | Grants present. Invoice POST **201**. Bill create **201**. `POST /bills/:id/approve` **200** (`bill.approve`). |
| **Tally / exports** | **APPROVE** | Project `export-tally` **200**; `/export/*-csv` **200** (OWNER\|ACCOUNTANT\|…). |
| **Amounts / budget / profit** | **APPROVE** | All three `financials.view_*` live. Company dashboard + GST/TDS reports **200**. Project P&L/cashflow/EVA **200**. |
| **`bill.approve`** | **APPROVE** | Permission + live approve **200**. |
| **Projects view / tab** | **APPROVE*** | `project.view` yes; mobile `ROLE_TABS` includes `projects`. *List `/projects` → `[]` (non-OWNER filtered to `projectMember`; seed ACCOUNTANT not a member). Direct `GET /projects/:id` still **200** (no membership gate). |
| **Project edit / create** | **TOO_MUCH** | No `project.edit`/`project.create` in catalog, but `PUT /projects/:id` and `POST /projects` are auth-only → live **200/201**. Violates “no project editing.” |
| **Estimate approve** | **APPROVE** | No `estimate.approve`. Live approve/reject **403** “Only OWNER…”. |
| **Estimate create / convert route** | **TOO_MUCH** | Estimate POST **201** (ungated). `ESTIMATE_MUTATION_ROLES` includes ACCOUNTANT; convert got **409** (status), not **403**. |
| **`settings.users`** | **APPROVE** | Live **403** missing `settings.users` / `settings.permissions`. |
| **Procurement PO approve** | **APPROVE** | No `procurement.approve_po`. Live approve **403**. |

---

## Why TOO_MUCH

Permission tags match Owner intent. Enforcement does not: ACCOUNTANT can **create and edit projects** and **create estimates** without tagged grants. Fix project CRUD (+ ideally estimate writes) with `requirePermission` / drop ACCOUNTANT from estimate mutation roles before re-review. Optionally treat ACCOUNTANT like OWNER for project **list** (company-wide view) or seed membership so the Projects tab is usable.

No app code changed in this verdict pass.

**Checked:** 2026-09-19 · API `http://localhost:4000/api` · Owner `owner@reddyconst.com` · ACCOUNTANT `accounts@reddyconst.com`
