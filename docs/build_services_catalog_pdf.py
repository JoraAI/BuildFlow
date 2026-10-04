#!/usr/bin/env python3
"""Generate BuildFlow Services Catalog PDF."""
from __future__ import annotations

import os

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BuildFlow_Services_Catalog.pdf")

NAVY = HexColor("#1E3A5F")
AMBER = HexColor("#F59E0B")
SLATE = HexColor("#334155")
MUTED = HexColor("#64748B")
LIGHT = HexColor("#F1F5F9")
BORDER = HexColor("#CBD5E1")

page_w, page_h = A4


def add_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, page_h - 16 * mm, page_w, 16 * mm, fill=1, stroke=0)
    canvas.setFillColor(AMBER)
    canvas.rect(0, page_h - 17.5 * mm, page_w, 1.5 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(18 * mm, page_h - 10 * mm, "BuildFlow v2.0 — Services Catalog")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(page_w - 18 * mm, page_h - 10 * mm, "Internal reference")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 10 * mm, "Confidential · For team understanding")
    canvas.drawRightString(page_w - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def main() -> None:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=13,
            textColor=HexColor("#E2E8F0"),
            alignment=TA_LEFT,
            leading=18,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1Doc",
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=NAVY,
            spaceBefore=10,
            spaceAfter=8,
            leading=20,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2Doc",
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=NAVY,
            spaceBefore=10,
            spaceAfter=4,
            leading=15,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyDoc",
            fontName="Helvetica",
            fontSize=9.5,
            textColor=SLATE,
            leading=13,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletDoc",
            fontName="Helvetica",
            fontSize=9.5,
            textColor=SLATE,
            leading=13,
            leftIndent=10,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CellDoc",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=SLATE,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CellHeadDoc",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            textColor=white,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="NoteDoc",
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            textColor=MUTED,
            leading=11,
            spaceAfter=6,
        )
    )

    story = []

    cover = Table(
        [
            [
                Paragraph(
                    "<font color='white'><b>BuildFlow</b></font><br/>"
                    "<font color='#F59E0B' size='14'>Services Catalog</font><br/><br/>"
                    "<font color='#E2E8F0' size='11'>Complete list of products, modules, and capabilities<br/>"
                    "Construction ERP · Inventory / Stock · Platform Admin</font><br/><br/>"
                    "<font color='#94A3B8' size='9'>Version 2.0 · Generated for internal team use</font>",
                    styles["CoverSub"],
                )
            ]
        ],
        colWidths=[page_w - 36 * mm],
    )
    cover.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 28),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 28),
            ]
        )
    )
    story.append(Spacer(1, 8 * mm))
    story.append(cover)
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            "This document lists every major service BuildFlow provides today across its two product modes "
            "and the Platform Admin console. Use it as a product reference for onboarding, demos, and planning.",
            styles["BodyDoc"],
        )
    )

    story.append(Paragraph("1. Product overview", styles["H1Doc"]))
    story.append(
        Paragraph(
            "BuildFlow is a multi-tenant SaaS platform with <b>two product modes</b> on one stack, plus a separate "
            "<b>Platform Admin</b> console for operator/tenant management.",
            styles["BodyDoc"],
        )
    )

    overview_rows = [
        [
            Paragraph("<b>Product</b>", styles["CellHeadDoc"]),
            Paragraph("<b>Who it serves</b>", styles["CellHeadDoc"]),
            Paragraph("<b>What it does</b>", styles["CellHeadDoc"]),
        ],
        [
            Paragraph("Construction ERP", styles["CellDoc"]),
            Paragraph("Contractors, PMs, site &amp; accounts teams", styles["CellDoc"]),
            Paragraph(
                "Projects, estimates/BOQ, planning, site ops, procurement, accounting, reports",
                styles["CellDoc"],
            ),
        ],
        [
            Paragraph("Inventory / Stock", styles["CellDoc"]),
            Paragraph("Material suppliers, retail, wholesale, traders, events businesses", styles["CellDoc"]),
            Paragraph(
                "Stock, SKUs, parties, quotes, sales, warehouse, procurement, invoices/bills, GST flows",
                styles["CellDoc"],
            ),
        ],
        [
            Paragraph("Platform Admin", styles["CellDoc"]),
            Paragraph("BuildFlow operators", styles["CellDoc"]),
            Paragraph("Tenant companies, subscriptions, escalated support tickets", styles["CellDoc"]),
        ],
    ]
    t = Table(overview_rows, colWidths=[38 * mm, 52 * mm, 80 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BACKGROUND", (0, 1), (-1, 1), LIGHT),
                ("BACKGROUND", (0, 3), (-1, 3), LIGHT),
                ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)

    story.append(Paragraph("2. Shared platform services", styles["H1Doc"]))
    for item in [
        "<b>Authentication</b> — Email/mobile OTP login (SMS/email delivery; seed/dev master OTP supported).",
        "<b>Multi-tenant companies</b> — Company signup, invites, roles, and isolated data per tenant.",
        "<b>Role-based access control</b> — Permission catalog with company-customizable role matrices.",
        "<b>BuildFlow Assistant</b> — In-app AI assistant (permission-aware tools) for construction &amp; inventory.",
        "<b>Notifications / Alerts</b> — In-app notification center (e.g. overdue invoices).",
        "<b>Support tickets</b> — Company tickets with escalation path to Platform Admin.",
        "<b>Audit log</b> — Track sensitive/admin actions.",
        "<b>Integrations</b> — WhatsApp, Razorpay, and related company integrations settings.",
        "<b>Subscription &amp; billing</b> — Plan/billing management at company level.",
        "<b>Data export / backup</b> — Company data export from settings.",
        "<b>Client &amp; subcontractor portals</b> — Tokenized portal access for external parties.",
        "<b>Offline-aware mobile UX</b> — Designed for field + desktop (web &amp; mobile viewports).",
    ]:
        story.append(Paragraph("• " + item, styles["BulletDoc"]))

    story.append(Paragraph("3. Construction ERP services", styles["H1Doc"]))
    story.append(
        Paragraph(
            "Product mode: <b>construction</b>. Primary navigation: Home, Projects, Planning, Proposals, Reports, "
            "Accounting, Reports Hub, Alerts, Settings, plus Assistant overlay.",
            styles["NoteDoc"],
        )
    )

    construction = [
        (
            "3.1 Home / Owner Dashboard",
            [
                "KPI cards: active projects, revenue, outstanding, average progress",
                "Cash flow forecast, budget burn / project progress, estimation accuracy",
                "Team productivity &amp; material price trend widgets",
                "Quick actions into projects, reports, accounting, proposals, settings",
            ],
        ),
        (
            "3.2 Projects",
            [
                "Create and manage projects (planning → in progress → completed, etc.)",
                "Project detail workspace for BOQ, procurement, variations, drawings, quality, labor",
                "Soft-delete / restore (permission-gated)",
                "Project members, budget, and financial visibility by permission",
            ],
        ),
        (
            "3.3 Estimation &amp; BOQ",
            [
                "Create, edit, submit, approve/reject estimates",
                "Convert approved estimate to Bill of Quantities (BOQ)",
                "BOQ edit, CSV import, rate visibility controls",
                "Record executed measurements against BOQ items",
                "Export estimates (Excel / PDF)",
                "Rate analysis library and estimate compare flows",
            ],
        ),
        (
            "3.4 Proposals &amp; tendering",
            [
                "Create and manage client proposals",
                "Proposal workflow tied to estimation/commercial process",
                "Portal management for client/subcontractor access",
            ],
        ),
        (
            "3.5 Planning (WBS / CPM)",
            [
                "View WBS, tasks, and Gantt/schedule planning",
                "Create/edit WBS items, tasks, and dependencies",
            ],
        ),
        (
            "3.6 Site operations &amp; reports",
            [
                "Daily site reports (view/create)",
                "Geo-fenced attendance check-in / check-out",
                "Attendance records visibility",
            ],
        ),
        (
            "3.7 Procurement &amp; site stock",
            [
                "Material indents / requisitions (including from BOQ shortfalls)",
                "Indent approval, direct PO creation, rate override, PO approval",
                "Goods Receipt Notes (GRN)",
                "Excess-order controls vs BOQ estimated limits",
                "Site stock view, movements (in/out/transfer), manual adjustments",
            ],
        ),
        (
            "3.8 Subcontracting",
            [
                "Subcontractor work orders",
                "Measurement approval for subcontract work",
            ],
        ),
        (
            "3.9 Change orders / variations",
            [
                "View, create, approve/reject change orders",
            ],
        ),
        (
            "3.10 Drawings &amp; blueprints",
            [
                "View/upload drawings and revisions",
                "Manage drawing status and approval revisions",
            ],
        ),
        (
            "3.11 Quality — snags &amp; NCRs",
            [
                "Snag/defect logging with evidence photos",
                "Rectify, status update, and sign-off",
            ],
        ),
        (
            "3.12 RFIs &amp; submittals",
            [
                "Raise and answer RFIs",
                "Material / shop-drawing submittals review &amp; approval",
            ],
        ),
        (
            "3.13 Labor muster &amp; wages",
            [
                "Gang muster and overtime recording",
                "Weekly wage settlement / payout approval",
            ],
        ),
        (
            "3.14 Petty cash",
            [
                "Site petty cash / float expense vouchers",
                "Receipt capture, approve/reject workflow",
            ],
        ),
        (
            "3.15 Accounting",
            [
                "Client invoices (Standard / RA / Milestone)",
                "Record client payments",
                "Vendor bills create/approve and record payments",
                "Import bills support",
                "Tally XML export for invoices &amp; bills",
                "Financial amount / profit / budget visibility by permission",
            ],
        ),
        (
            "3.16 Reports Hub",
            [
                "Central finance/ops report viewing",
                "Download PDF / Excel reports",
                "Report branding settings",
            ],
        ),
        (
            "3.17 Construction admin settings",
            [
                "Company profile &amp; logo",
                "Users, invites &amp; roles",
                "Role permission customization",
                "Material prices / resource library",
                "Rate regions &amp; regional pricing",
                "Rate analysis library",
                "Integrations, billing, audit log, export/backup, support tickets",
                "Personal profile &amp; help",
            ],
        ),
    ]

    for title, bullets in construction:
        block = [Paragraph(title, styles["H2Doc"])]
        for b in bullets:
            block.append(Paragraph("• " + b, styles["BulletDoc"]))
        story.append(KeepTogether(block))

    story.append(PageBreak())
    story.append(Paragraph("4. Inventory / Stock services", styles["H1Doc"]))
    story.append(
        Paragraph(
            "Product mode: <b>inventory</b>. Shell navigation: Stock, Materials, Parties, Quotes, Sales, Warehouse, "
            "Procurement, Invoices, Bills, Settings (+ Reports, Notifications, Assistant).",
            styles["NoteDoc"],
        )
    )

    inventory = [
        (
            "4.1 Stock home",
            [
                "On-hand stock by warehouse with inventory value overview",
                "Search, barcode/QR scan, adjust, and checkout actions",
                "Opening stock import",
                "Anomaly / overview strip for stock health",
            ],
        ),
        (
            "4.2 Materials (SKU catalog)",
            [
                "Material/SKU master with units and pricing",
                "Suggested catalogs by business profile / vertical",
                "Batch/expiry (FEFO) support for general retail vertical demos",
            ],
        ),
        (
            "4.3 Parties",
            [
                "Customers and vendors (party master)",
                "Search/filter and cross-navigation into sales/procurement",
            ],
        ),
        (
            "4.4 Quotes",
            [
                "Customer quotations / event-quote wording for Events vertical",
                "Quote lifecycle ahead of sales conversion",
            ],
        ),
        (
            "4.5 Sales",
            [
                "Sales flows including SO / delivery / returns / notes style ops",
                "POS-style checkout from stock",
                "List filters and status tabs",
            ],
        ),
        (
            "4.6 Warehouse",
            [
                "Multi-warehouse locations",
                "Transfers, staging, counts / warehouse operations",
            ],
        ),
        (
            "4.7 Procurement",
            [
                "Purchase-side procurement for restocking",
                "Vendor-linked buying workflows",
                "Filtered list navigation into bills/parties",
            ],
        ),
        (
            "4.8 Invoices (AR)",
            [
                "Sales invoices with search/status filters",
                "GST-oriented commercial docs",
                "Invoice detail views and payment tracking",
            ],
        ),
        (
            "4.9 Bills (AP)",
            [
                "Purchase bills with sticky filters",
                "Vendor bill lifecycle for inventory tenants",
            ],
        ),
        (
            "4.10 Inventory reports",
            [
                "Inventory analytics / ops reports screen",
            ],
        ),
        (
            "4.11 Inventory settings &amp; profiles",
            [
                "Business profile (material supplier, retail, wholesale, distribution, trading, equipment, general)",
                "Shop verticals: GENERAL and EVENTS capability lanes",
                "Language preferences, team/users, notifications",
                "Company-level inventory configuration",
            ],
        ),
    ]

    for title, bullets in inventory:
        block = [Paragraph(title, styles["H2Doc"])]
        for b in bullets:
            block.append(Paragraph("• " + b, styles["BulletDoc"]))
        story.append(KeepTogether(block))

    story.append(Paragraph("4.12 Inventory business profiles (demo catalog)", styles["H2Doc"]))
    for p in [
        "Material supplier (construction materials)",
        "Retail store / Kirana (GENERAL + batch/expiry FEFO)",
        "Wholesale / cash &amp; carry",
        "Distributor / stockist",
        "Trader / trading company",
        "Equipment dealer / rental",
        "Events &amp; lighting (EVENTS vertical)",
        "General business",
    ]:
        story.append(Paragraph("• " + p, styles["BulletDoc"]))

    story.append(Paragraph("5. Platform Admin services", styles["H1Doc"]))
    story.append(
        Paragraph(
            "Separate login at <b>/platform/login</b> (not the company OTP login).",
            styles["NoteDoc"],
        )
    )
    for item in [
        "Platform dashboard — company count and open escalated tickets overview",
        "Companies — search tenants, update subscription and legal fields",
        "Escalated tickets — review requests escalated from company owners",
        "Platform admin authentication (email + password)",
    ]:
        story.append(Paragraph("• " + item, styles["BulletDoc"]))

    story.append(Paragraph("6. Roles that use these services", styles["H1Doc"]))
    story.append(Paragraph("Construction roles", styles["H2Doc"]))
    for r in [
        "Owner / MD — full access",
        "Project Manager (PM)",
        "Deputy Project Manager (DPM)",
        "Senior QC Engineer",
        "Mechanical Manager",
        "Store Incharge",
        "WeighBridge Incharge",
        "Site Supervisor",
        "Accountant",
    ]:
        story.append(Paragraph("• " + r, styles["BulletDoc"]))
    story.append(Paragraph("Inventory roles", styles["H2Doc"]))
    for r in [
        "Owner — full inventory + settings",
        "Inventory Manager — day-to-day stock, sales, procurement",
    ]:
        story.append(Paragraph("• " + r, styles["BulletDoc"]))
    story.append(Paragraph("Platform", styles["H2Doc"]))
    story.append(Paragraph("• Platform Admin — tenants, subscriptions, escalations", styles["BulletDoc"]))

    story.append(Paragraph("7. Capability summary matrix", styles["H1Doc"]))
    matrix = [
        [
            Paragraph("<b>Capability area</b>", styles["CellHeadDoc"]),
            Paragraph("<b>Construction</b>", styles["CellHeadDoc"]),
            Paragraph("<b>Inventory</b>", styles["CellHeadDoc"]),
            Paragraph("<b>Platform</b>", styles["CellHeadDoc"]),
        ],
        ["Projects &amp; WBS planning", "Yes", "—", "—"],
        ["Estimates / BOQ / proposals", "Yes", "Quotes (commercial)", "—"],
        ["Site reports / attendance / QC", "Yes", "—", "—"],
        ["Procurement", "Yes (indent/PO/GRN)", "Yes", "—"],
        ["Stock / warehouse", "Site stock", "Full multi-warehouse", "—"],
        ["Sales / POS / checkout", "—", "Yes", "—"],
        ["Invoices &amp; bills", "Yes + Tally", "Yes (AR/AP)", "—"],
        ["Reports hub / analytics", "Yes", "Inventory reports", "—"],
        ["AI Assistant", "Yes", "Yes", "—"],
        ["Users / permissions / audit", "Yes", "Yes", "Tenant-level ops"],
        ["Tenant subscriptions", "Company billing", "Company billing", "Yes"],
        ["Support tickets", "Yes", "Yes", "Escalations"],
    ]
    mrows = [matrix[0]]
    for row in matrix[1:]:
        mrows.append([Paragraph(c, styles["CellDoc"]) for c in row])
    mt = Table(mrows, colWidths=[48 * mm, 42 * mm, 42 * mm, 38 * mm])
    mt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(mt)

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("8. Related team materials", styles["H1Doc"]))
    for item in [
        "Team walkthrough PPT: <b>docs/team-ppt/BuildFlow_Team_Walkthrough.pptx</b>",
        "Demo credentials: <b>docs/DEMO_CREDENTIALS.txt</b>",
        "Owner construction guide PPT: <b>docs/owner-ppt/</b>",
    ]:
        story.append(Paragraph("• " + item, styles["BulletDoc"]))

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=AMBER, spaceBefore=4, spaceAfter=8))
    story.append(
        Paragraph(
            "BuildFlow v2.0 — built for the field, designed for the boardroom.",
            styles["NoteDoc"],
        )
    )

    doc = SimpleDocTemplate(
        OUT,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=16 * mm,
        title="BuildFlow Services Catalog",
        author="BuildFlow",
    )
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print("Wrote", OUT)
    print("size_kb", round(os.path.getsize(OUT) / 1024, 1))


if __name__ == "__main__":
    main()
