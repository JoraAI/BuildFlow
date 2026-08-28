# BuildFlow Construction - Powerplay Parity & Advanced Field Operations Plan

> **Audience:** Deepseek-V4-Flash / AI Coding Agent & BuildFlow Core Engineers  
> **Repo:** `/home/prasanna/work/BuildFlow`  
> **Objective:** Implement full functional parity and surpass Powerplay across field operations, site finance, vernacular accessibility, blueprint revision management, quality inspections, and WhatsApp workflows, while maintaining BuildFlow's enterprise depth (BOQ, CPWD rate analysis, RA billing, Tally export, and dual-mode horizontal platform).

---

## 0. Architectural Principles & Guardrails

1. **Non-Regression Policy:** Do **not** modify or break existing Construction Draft $\rightarrow$ Submit $\rightarrow$ Approve procurement flows, BOQ estimation logic, RA invoice generation, or the ₹499 Inventory platform.
2. **Granular RBAC First:** Every new module MUST have discrete granular permissions in `packages/shared/src/permissions/catalog.ts` and `PERMISSION_GROUPS`, guarded by `requirePermission()` on the backend and `<PermissionGate>` / `usePermission()` on mobile.
3. **Owner Full Sovereignty:** The `OWNER` role always has `ALL_PERMISSIONS`. Owners customize these permissions per role in **Settings $\rightarrow$ Role Permissions**.
4. **Mobile + Web Responsive:** All UI additions must support Phone, Tablet, and Desktop using `useViewport()`.

---

## 1. Master Implementation Roadmap (7 Core Modules)

```
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                   BUILDFLOW FIELD OPERATING SYSTEM (ROADMAP)                    │
 ├─────────────────────────────────────────────────────────────────────────────────┤
 │ 1. Site Petty Cash Ledger & Instant Bill Voucher Capture                        │
 │ 2. Offline-First Site Sync Engine (Queue & Conflict Resolution)                 │
 │ 3. Vernacular / 10-Language Indian Regional Support                             │
 │ 4. Drawing & Blueprint Revision Management with On-Plan Coordinate Pins         │
 │ 5. Snag List, Quality Checklists & Safety Inspections (NCRs)                    │
 │ 6. Manpower Gang Headcounts, Overtime & Daily Labor Wage Sheet                  │
 │ 7. 1-Tap WhatsApp Client & Subcontractor Progress Broadcasts                   │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Specifications & Database Schemas

### Module 1: Site Petty Cash & Expense Management

#### Problem & Target UX
Site supervisors incur daily untracked cash spends (fuel for DG sets, emergency hardware, tea/food for labor gangs, local transport). Powerplay excels by offering a live petty cash float with camera receipt snaps and 1-tap owner approval.

#### Prisma Schema (`apps/backend/prisma/schema.prisma`)
```prisma
enum PettyCashCategory {
  FUEL_AND_POWER
  SITE_TEA_AND_MEALS
  LOCAL_HARDWARE
  TRANSPORT_AND_TRAVEL
  EQUIPMENT_REPAIR
  EMERGENCY_LABOR
  MISCELLANEOUS
}

enum PettyCashTxType {
  FLOAT_CREDIT    // Owner/PM gives money to supervisor
  EXPENSE_DEBIT   // Supervisor spends cash on site
  RETURN_CREDIT   // Supervisor returns balance to owner
}

enum PettyCashStatus {
  PENDING_APPROVAL
  APPROVED
  REJECTED
}

model PettyCashAccount {
  id           String                 @id @default(uuid()) @db.Uuid
  companyId    String                 @map("company_id") @db.Uuid
  projectId    String                 @map("project_id") @db.Uuid
  custodianId  String                 @map("custodian_id") @db.Uuid // User holding the float
  balance      Decimal                @default(0) @db.Decimal(12, 2)
  createdAt    DateTime               @default(now()) @map("created_at")
  updatedAt    DateTime               @updatedAt @map("updated_at")

  company      Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  project      Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  custodian    User                   @relation(fields: [custodianId], references: [id])
  transactions PettyCashTransaction[]

  @@unique([projectId, custodianId])
  @@map("petty_cash_accounts")
}

model PettyCashTransaction {
  id              String             @id @default(uuid()) @db.Uuid
  accountId       String             @map("account_id") @db.Uuid
  companyId       String             @map("company_id") @db.Uuid
  projectId       String             @map("project_id") @db.Uuid
  type            PettyCashTxType
  category        PettyCashCategory?
  amount          Decimal            @db.Decimal(12, 2)
  balanceAfter    Decimal            @map("balance_after") @db.Decimal(12, 2)
  description     String
  receiptPhotoUrl String?            @map("receipt_photo_url")
  vendorName      String?            @map("vendor_name")
  status          PettyCashStatus    @default(PENDING_APPROVAL)
  submittedById   String             @map("submitted_by_id") @db.Uuid
  approvedById    String?            @map("approved_by_id") @db.Uuid
  approvedAt      DateTime?          @map("approved_at")
  rejectionReason String?            @map("rejection_reason")
  createdAt       DateTime           @default(now()) @map("created_at")

  account         PettyCashAccount   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  submittedBy     User               @relation("PettyCashSubmitted", fields: [submittedById], references: [id])
  approvedBy      User?              @relation("PettyCashApproved", fields: [approvedById], references: [id])

  @@index([companyId, projectId, status])
  @@map("petty_cash_transactions")
}
```

#### New Permissions
* `petty_cash.view`: View petty cash balance and transaction feed.
* `petty_cash.record_expense`: Submit on-site cash expense with receipt photo.
* `petty_cash.allocate_fund`: Allocate/top-up float cash to supervisors.
* `petty_cash.approve`: Approve or reject supervisor expense submissions.

---

### Module 2: Offline-First Site Sync Engine

#### Architecture & Strategy
Sites in basements, rural highway packages, and remote substations suffer from zero connectivity.
* **Storage:** Local encrypted queue via `AsyncStorage` / SQLite storage.
* **Queue Item Structure:**
  ```typescript
  interface OfflineMutation {
    id: string; // UUID v4 idempotency key
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body: Record<string, unknown>;
    timestamp: number;
    retryCount: number;
    resourceType: 'daily_report' | 'attendance' | 'grn' | 'stock_issue' | 'petty_cash' | 'snag';
  }
  ```
* **Sync Controller (`apps/mobile/lib/offline-sync.ts`):**
  * Detects network transition using NetInfo (`online` / `offline`).
  * Flushes pending queue FIFO with bearer token refresh.
  * Replaces temp local IDs with server-persisted UUIDs.
  * Emits status banners: `Offline (3 pending actions)` $\rightarrow$ `Syncing…` $\rightarrow$ `All changes saved`.

---

### Module 3: 10-Language Indian Vernacular Localization

#### Languages Supported
1. English (`en`)
2. Hindi (`hi`)
3. Tamil (`ta`)
4. Telugu (`te`)
5. Kannada (`kn`)
6. Marathi (`mr`)
7. Bengali (`bn`)
8. Gujarati (`gu`)
9. Malayalam (`ml`)
10. Punjabi (`pa`)

#### Implementation Plan
* Location: `packages/shared/src/i18n/` dictionaries.
* Scope: Primary field screens:
  * Daily Site Progress Report logger
  * Geo-fenced Manpower / Attendance check-in
  * Barcode & Material Stock / GRN receiver
  * Petty Cash expense entry form
  * Snag reporter & task checklist
* Persistence: User preferences saved to `User.preferredLanguage` and persisted locally in `AsyncStorage`.

---

### Module 4: Drawing & Blueprint Revision Management with On-Plan Pins

#### Problem & Target UX
Contractors frequently build using outdated drawing versions, causing massive rework costs. BuildFlow will store all architectural, structural, MEP, and HVAC drawings with clear `Rev-A`, `Rev-B` labels and a zoomable mobile viewer with coordinate pinning.

#### Prisma Schema (`apps/backend/prisma/schema.prisma`)
```prisma
enum DrawingCategory {
  ARCHITECTURAL
  STRUCTURAL
  MEP
  ELECTRICAL
  PLUMBING
  HVAC
  LANDSCAPING
  OTHER
}

model ProjectDrawing {
  id          String            @id @default(uuid()) @db.Uuid
  projectId   String            @map("project_id") @db.Uuid
  companyId   String            @map("company_id") @db.Uuid
  drawingNo   String            @map("drawing_no") // e.g., "STR-B1-004"
  title       String
  category    DrawingCategory
  currentRev  String            @default("R0") @map("current_rev")
  revisions   DrawingRevision[]
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  @@unique([projectId, drawingNo])
  @@map("project_drawings")
}

model DrawingRevision {
  id             String         @id @default(uuid()) @db.Uuid
  drawingId      String         @map("drawing_id") @db.Uuid
  revisionNumber String         @map("revision_number") // e.g., "Rev-A"
  fileUrl        String         @map("file_url")
  fileSize       Int            @map("file_size")
  isApproved     Boolean        @default(true) @map("is_approved")
  uploadedById   String         @map("uploaded_by_id") @db.Uuid
  changeNotes    String?        @map("change_notes")
  pins           DrawingPin[]
  createdAt      DateTime       @default(now()) @map("created_at")

  drawing        ProjectDrawing @relation(fields: [drawingId], references: [id], onDelete: Cascade)
  uploadedBy     User           @relation(fields: [uploadedById], references: [id])

  @@map("drawing_revisions")
}

model DrawingPin {
  id          String          @id @default(uuid()) @db.Uuid
  revisionId  String          @map("revision_id") @db.Uuid
  xCoord      Float           @map("x_coord") // Normalized 0.0 to 1.0
  yCoord      Float           @map("y_coord") // Normalized 0.0 to 1.0
  pinType     String          @map("pin_type") // "SNAG" | "RFI" | "NOTE"
  referenceId String?         @map("reference_id") @db.Uuid // Snag ID
  title       String
  createdAt   DateTime        @default(now()) @map("created_at")

  revision    DrawingRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@map("drawing_pins")
}
```

#### New Permissions
* `drawing.view`: View blueprints and zoom into plans.
* `drawing.upload`: Upload new drawings and revised revisions.
* `drawing.approve_revision`: Mark a revision as approved for construction (AFC).

---

### Module 5: Snag List, Quality Checklists & Safety Inspections (NCRs)

#### Problem & Target UX
Site engineers spot workmanship defects (honeycombing in concrete, unlevel plaster, missing conduits, safety violations). Powerplay provides a streamlined photo $\rightarrow$ assign $\rightarrow$ resolve $\rightarrow$ close lifecycle.

#### Prisma Schema (`apps/backend/prisma/schema.prisma`)
```prisma
enum SnagSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum SnagStatus {
  OPEN
  WORK_IN_PROGRESS
  READY_FOR_INSPECTION
  CLOSED
  REJECTED
}

model SiteSnag {
  id              String       @id @default(uuid()) @db.Uuid
  companyId       String       @map("company_id") @db.Uuid
  projectId       String       @map("project_id") @db.Uuid
  drawingPinId    String?      @map("drawing_pin_id") @db.Uuid
  title           String
  description     String
  locationDetails String?      @map("location_details") // e.g. "Tower A, 4th Floor Flat 402"
  severity        SnagSeverity @default(MEDIUM)
  status          SnagStatus   @default(OPEN)
  beforePhotoUrl  String       @map("before_photo_url")
  afterPhotoUrl   String?      @map("after_photo_url")
  subcontractorId String?      @map("subcontractor_id") @db.Uuid
  dueDate         DateTime?    @map("due_date")
  createdById     String       @map("created_by_id") @db.Uuid
  resolvedById    String?      @map("resolved_by_id") @db.Uuid
  closedById      String?      @map("closed_by_id") @db.Uuid
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  project         Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy       User         @relation("SnagCreated", fields: [createdById], references: [id])
  closedBy        User?        @relation("SnagClosed", fields: [closedById], references: [id])

  @@index([companyId, projectId, status])
  @@map("site_snags")
}
```

#### New Permissions
* `snag.view`: View project snag lists and inspection checklists.
* `snag.create`: Create defect tickets with photo evidence.
* `snag.resolve`: Mark a defect as fixed with after-photos.
* `snag.close`: Final quality sign-off and closure.

---

### Module 6: Manpower Gang Headcounts & Daily Labor Wage Sheet

#### Problem & Target UX
Indian contractors manage labor as "Gangs" (Mason + 2 Helpers, Carpenter gang, Barbending gang) paid weekly on Saturdays. Powerplay automates headcounts, overtime (OT), cash advances, and generates Saturday payout slips.

#### Prisma Schema (`apps/backend/prisma/schema.prisma`)
```prisma
enum LaborTrade {
  MASON
  HELPER
  CARPENTER
  BAR_BENDER
  ELECTRICIAN
  PLUMBER
  PAINTER
  WELDER
  RIGGER
  OPERATOR
}

model LaborGangLog {
  id              String     @id @default(uuid()) @db.Uuid
  companyId       String     @map("company_id") @db.Uuid
  projectId       String     @map("project_id") @db.Uuid
  date            DateTime   @db.Date
  trade           LaborTrade
  headcount       Int        @default(1)
  shiftHours      Decimal    @default(8.0) @map("shift_hours") @db.Decimal(4, 1)
  overtimeHours   Decimal    @default(0.0) @map("overtime_hours") @db.Decimal(4, 1)
  dailyRatePerHead Decimal   @map("daily_rate_per_head") @db.Decimal(10, 2)
  advancePaid     Decimal    @default(0.0) @map("advance_paid") @db.Decimal(10, 2)
  subcontractorId String?    @map("subcontractor_id") @db.Uuid
  notes           String?
  recordedById    String     @map("recorded_by_id") @db.Uuid
  createdAt       DateTime   @default(now()) @map("created_at")

  project         Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  recordedBy      User       @relation(fields: [recordedById], references: [id])

  @@index([companyId, projectId, date])
  @@map("labor_gang_logs")
}
```

#### New Permissions
* `labor.view`: View daily manpower logs and attendance summaries.
* `labor.log_headcount`: Record daily gang counts, overtime, and advances.
* `labor.manage_rates`: Configure standard daily wage rates per trade.
* `labor.payout`: Generate weekly labor settlement wage sheets.

---

### Module 7: 1-Tap WhatsApp Native Progress Broadcasts

#### Problem & Target UX
Indian construction owners and clients prefer receiving bite-sized daily progress snapshots on WhatsApp rather than logging into a web portal.

#### Implementation
* Dedicated WhatsApp message card generator (`apps/mobile/utils/whatsapp-share.ts`):
  * **Daily Progress Update:** `*BuildFlow Progress Report* 🏗️\nProject: Sky High Tower\nDate: 28 Aug 2026\n• Concrete Poured: 45 m³ (4th Floor Slab)\n• Manpower: 38 on site\n• Weather: Clear\n📸 View Photos: https://app.buildflow.in/p/xyz/reports/123`
  * **Material PO Dispatch:** Vendor order message with PDF attachment link.
  * **Payment Receipt / RA Bill summary:** Milestone invoice link with GST breakdown.
* Uses native `Linking.openURL('whatsapp://send?text=' + encodeURIComponent(msg))` with fallback to web WhatsApp.

---

## 3. Deepseek-V4-Flash Master Implementation Prompt (Copy-Paste)

```markdown
You are Deepseek-V4-Flash, the coding agent for BuildFlow.

Your task is to implement the Powerplay Parity & Advanced Field Operations plan defined in `docs/CONSTRUCTION_POWERPLAY_PARITY_PLAN.md`.

### Core Rules & Constraints:
1. ROLE: Coding agent only. Do NOT hard-code Deepseek as an in-app user-facing chat model.
2. NON-REGRESSION: Do NOT alter existing Construction Draft → Submit → Approve procurement gates, BOQ rate analysis, or the ₹499 Inventory platform.
3. RBAC & PERMISSIONS: 
   - Add new permissions to `packages/shared/src/permissions/catalog.ts` and `defaults.ts`.
   - Update `PERMISSION_GROUPS` so they appear inside the Owner's Role Permissions matrix.
   - Guard all new backend routes with `requirePermission('module.action')`.
4. IMPLEMENTATION MODULES TO CODE:
   - Module 1: Site Petty Cash Ledger & Camera Receipt Expense Logger (`apps/backend/src/routes/petty-cash.routes.ts`, `apps/mobile/app/(app)/projects/[id]/petty-cash.tsx`).
   - Module 2: Offline-First Queue Manager (`apps/mobile/lib/offline-sync.ts`).
   - Module 3: 10-Language Indian Localization Dictionaries (`packages/shared/src/i18n/`).
   - Module 4: Drawing & Blueprint Revision Viewer with Pin Markups (`apps/mobile/components/drawings/DrawingPlanViewer.tsx`).
   - Module 5: Snag List & Quality NCR Tracker (`apps/mobile/app/(app)/projects/[id]/snags.tsx`).
   - Module 6: Manpower Gang Headcount & Saturday Wage Sheet (`apps/mobile/components/labor/LaborWageSheet.tsx`).
   - Module 7: 1-Tap WhatsApp Progress Share Utility (`apps/mobile/utils/whatsapp-share.ts`).
5. VERIFICATION:
   - Run `packages/shared` build.
   - Run backend tests to guarantee 100% pass rate.
   - Ensure `apps/mobile` TypeScript check runs clean.
```
