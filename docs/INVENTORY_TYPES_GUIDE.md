# BuildFlow Inventory types and status changes

All seven inventory types run on the **same** stock, purchase, and sales engines. The profile you pick in **Settings** describes the kind of business you are. It changes labels and demo data. It does **not** change status names or lock you out of Issue, Sales, or Procurement.

**Demo password** (all seeded users): `Test@1234`

---

## The one wording split

| Profile | Catalog tab | Purchase request | Store |
|---|---|---|---|
| **Material supplier** | Materials | Indent / Indents | Store |
| **Every other inventory type** | Items | Purchase request(s) | Store |

---

## The seven types

### 1. Retail store (`RETAIL`)
- **Best for:** Counter / shop sales in small quantities (hardware, electrical, finishing).
- **Typical catalog:** PVC fittings, bulbs, wall putty.
- **How they usually sell:** Stock → **Issue** (walk-in). Formal sales order when a contractor wants a billed order.
- **Demo:** `owner@cityhardware.com` · City Hardware Retail

### 2. Wholesale / cash & carry (`WHOLESALE`)
- **Best for:** Bulk boxes and rims sold to shops and offices, often same-day pickup.
- **Typical catalog:** Cartons, rims, packing tape - higher opening quantities.
- **How they usually sell:** Mix of **Issue** (cash counter) and **Sales order + dispatch** for billed lots.
- **Demo:** `owner@deccanwholesale.com` · Deccan Wholesale Mart

### 3. Distributor / stockist (`DISTRIBUTION`)
- **Best for:** Brand or spare-parts stockist supplying dealers; often more than one warehouse later.
- **Typical catalog:** Auto / spare SKUs (belts, filters, pad sets).
- **How they usually sell:** Prefer **Sales order → challan → dispatch** so each dealer shipment has a DC and draft invoice.
- **Demo:** `owner@southdistro.com` · South Distro Spares

### 4. Trader / trading company (`TRADING`)
- **Best for:** Buy-and-sell of commodities (steel, pipes, sheets) by weight or metre.
- **Typical catalog:** MS angle, GI pipe, CR sheet.
- **How they usually sell:** Purchase (indent → PO → GRN) then sell via Sales order or Issue depending on whether goods leave today.
- **Demo:** `owner@apextrading.com` · Apex Trading Co

### 5. Material supplier - construction (`MATERIAL_SUPPLIER`)
- **Best for:** Cement, steel, sand, bricks sold to sites. Closest to construction store language.
- **Typical catalog:** OPC cement, TMT, sand, bricks, aggregate. Richest demo: 2 warehouses, parties, price list.
- **Wording:** **Materials** / **Indent** (not Items / Purchase request).
- **How they usually sell:** Site pickup → **Issue**. Site delivery → **Sales order + dispatch + challan PDF**.
- **Demo:** `owner@hydmaterials.com` (also `manager@hydmaterials.com`)

### 6. Equipment dealer / rental (`EQUIPMENT`)
- **Best for:** Stocking plant and access equipment rather than consumable bags.
- **Typical catalog:** Mixer, vibrator, scaffold - catalog type EQUIPMENT, high unit rates, low qty.
- **Note:** Status machines are still the same. This is not a rental calendar / hire module.
- **How they usually sell:** Usually **Sales order + dispatch** (high value). Issue is available for walk-in cash sale.
- **Demo:** `owner@forgeequip.com` · Forge Equipment Dealers

### 7. General business (`GENERAL`)
- **Best for:** Default when the business does not fit the others. Same full inventory product.
- **Typical catalog:** Mixed SKUs (fasteners, PPE). Safe starting profile.
- **How they usually sell:** Use Issue if they take goods now, or a sales order if you ship later.
- **Demo:** `owner@generalstore.com` · General Goods Store

### What is the same for every type
- Stock, Procurement, Sales, Warehouse, Parties, Invoices, Bills, Settings, Tally export
- GST draft invoices on stock issue and on challan dispatch
- Credit-limit policy (Allow / Warn / Block) and PO approval thresholds - company settings, not profile-specific
- Barcode identify, stock adjustments, transfers, stock counts, quotes, returns, credit/debit notes

---

## Two ways to sell (every type)

This is the difference operators feel day to day. It is **not** tied to retail vs wholesale - any profile can use both.

### A. Issue (Stock or item screen) - walk-in / counter
Goods leave **now**.

`Pick item → Issue qty + price → Stock OUT → Draft invoice → INVOICED counter sale on Sales`

- No confirm, no challan, no deliver step
- Sales list shows “Counter sale from stock issue - already invoiced”
- Confirm the draft on Sales invoices (`DRAFT → SENT`) then record payment (`SENT → PAID`)

### B. Sales order (Sales screen) - order first, ship later
Creating the order does **not** move stock.

`Quote (optional) → Sales order DRAFT → Confirm → Challan DRAFT → Dispatch (stock OUT + draft invoice) → Deliver`

- **Dispatch** is the moment stock leaves (same as Issue for inventory), plus a delivery challan
- After dispatch the sales order is **INVOICED** and a draft invoice exists
- **Deliver** only marks “customer received”
- Use this when you need a challan PDF, a named customer, or goods leave on another day

| Situation | Use |
|---|---|
| Customer at the counter today | Issue |
| Order now, send tomorrow / to site | Sales order → challan → dispatch |
| Need a quote first | Quote → accept → sales order |
| Need proof of dispatch | Sales order path (challan PDF) |
| Retail / wholesale cash | Usually Issue |
| Distributor / equipment / site delivery | Usually Sales order |

---

## Status changes (shared by all types)

Statuses do **not** differ by inventory type. Forward-only unless noted.

### Sales order
`DRAFT → CONFIRMED → DELIVERED → INVOICED`

- DRAFT → **Confirm**
- CONFIRMED → **Create challan**. After full dispatch the order becomes DELIVERED, then auto-invoiced → INVOICED
- INVOICED → **Go to invoices** (no second stock OUT)
- **Cancel** from CONFIRMED or DELIVERED (not after INVOICED)
- Counter sales from Issue are created already INVOICED

### Quote
`DRAFT → SENT → ACCEPTED → Sales order`

SENT can also be **Rejected**. Accepted quotes convert to a sales order.

### Delivery challan
`DRAFT → DISPATCHED → DELIVERED`

- DRAFT → **Dispatch** (stock OUT from the chosen warehouse; draft invoice if linked to a sales order)
- DISPATCHED → **Deliver** (acknowledgement only)
- Cancel only while still DRAFT (before stock has moved)

### Sales invoice (AR)
`DRAFT → SENT → PAID`

- Created as DRAFT from Issue, from dispatch, or manually
- Confirm / Send → SENT. Past due date while unpaid → **OVERDUE**
- Record payment → PAID when the balance is cleared. Partial payments stay SENT/OVERDUE until fully paid

### Purchase request / Indent → Purchase order → GRN
`Indent created → PO created → PO APPROVED → Record GRN → Draft vendor bill`

- Inventory indents are created already approved so you can raise a PO immediately
- PO status: **DRAFT / SUBMITTED / APPROVED** (and **REJECTED** if declined)
- Auto-approve below the first ₹ threshold; manager band in the middle; owner only above the second. Both 0 = always auto-approve
- GRN brings stock **IN** and creates a draft vendor bill. Then go to Vendor bills

### Vendor bill (AP)
`DRAFT → APPROVED → PAID`

- GRN bills start as DRAFT. Confirm / Approve → APPROVED. Reject → REJECTED
- Record payment on an approved bill → PAID (or remain APPROVED if partially paid)
- PENDING appears for bills that still need approval in the construction-style flow

### Warehouse transfer
`DRAFT → IN_TRANSIT → RECEIVED`

- Create transfer (only items on hand at the **source** warehouse)
- Dispatch → IN_TRANSIT (stock leaves source)
- Receive → RECEIVED (stock arrives at destination)
- Cancel while DRAFT

### Stock count
`DRAFT → APPROVED`

Create count, enter counted qty, **Approve** to write ADJUST movements. **Cancel** abandons the count.

### Returns and notes
`Return recorded → Draft credit / debit note → ISSUED`

- Sales return (from a customer invoice) restores good stock and opens a draft credit note
- Purchase return (to a vendor) reduces stock and opens a draft debit note
- Note statuses: **DRAFT → ISSUED**, or **VOID**

### Stock movements (item history screen)
| Type | Examples |
|---|---|
| **IN** | GRN, transfer in, sales return (good), opening stock, found stock |
| **OUT** | Issue, challan dispatch, transfer out, purchase return |
| **ADJUST** | Manual adjust, stock count approval (damage / loss / correction / etc.) |

---

## Side-by-side

| Type | Wording | Typical sell path | Catalog flavour |
|---|---|---|---|
| Retail | Items | Issue first | Small-qty shop SKUs |
| Wholesale | Items | Issue and SO mix | Boxes / rims / cartons |
| Distribution | Items | SO + challan | Dealer / spare SKUs |
| Trading | Items | PO in, SO or Issue out | Kg / metre commodities |
| Material supplier | Materials / Indent | Issue (pickup) or SO (site) | Cement, steel, sand, bricks |
| Equipment | Items | SO + dispatch | High-value EQUIPMENT SKUs |
| General | Items | Either | Mixed / starting point |

### Company settings that are not “types” but change behaviour
- **Credit limit policy:** ALLOW (no check), WARN (toast, still creates invoice), BLOCK (reject if over limit)
- **PO auto-approve** below ₹X; owner must approve above ₹Y
- **Customer price lists** override catalog rate on Issue and on sales orders
- **Multi-warehouse:** dispatch/issue/adjust can target a store; transfers move between them

### Inventory product vs construction ERP
| | |
|---|---|
| **Inventory types (this guide)** | One hidden Main Store, inventory shell, no BOQ / projects / subcontracts |
| **Construction** | Projects, estimates, planning, RA invoices, work orders. Procurement still exists but on a project |
| **Do not mix** | An inventory company cannot become construction ERP by changing profile |

---

## Suggested walkthrough

1. Log in as `owner@hydmaterials.com` (material supplier, richest demo) with `Test@1234`
2. Stock: open an item screen, then **Issue** a small qty - confirm the draft invoice, see the counter sale on Sales
3. Sales: New order → Confirm → New challan → **Dispatch** - confirm the new draft invoice
4. Procurement: purchase request → PO → GRN → Vendor bills
5. Settings: switch profile to Retail and refresh - tab says **Items** instead of **Materials**; statuses unchanged
6. Optionally log into `owner@forgeequip.com` or `owner@cityhardware.com` to see catalog flavour only

Change the profile any time under **Inventory → Settings → Business profile** (OWNER).
