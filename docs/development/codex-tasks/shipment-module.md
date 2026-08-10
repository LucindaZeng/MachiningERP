# Codex Task: `shipment` module (shipments + customer statements)

> Status: **done (2026-08-11)**. Accepted deviations & notes: ① three read-port stubs with documented semantics — QC defaults to *released* (warn-logged; MUST flip to real QMS data before go-live, tracked in TODO), receipts default to zero (prepay/cash blocked by design), statement invoice/return sources return empty until those modules land; ② partial/full shipment maps onto contract-order's existing EXECUTING/COMPLETED via the `sales.shipment.posted` event (no enum added from outside), CLOSED stays manual; ③ tail plan applies per-line, header shows a plan only when all tail lines agree; ④ real API aggregates header quantities over lines (the demo fixture's header arithmetic is inconsistent — fixture fix pending). Coverage: shipment/services 97.47% branch. Migration must be generated locally: `pnpm -F @machining-erp/api prisma:migrate --name shipment`.
>
> Queue after this: invoice-request → sales-return → customs → sales-analytics → docgen → ecn-request → final mock-to-API sweep. Completed so far: bom-request, shipment.

ONE step only. Do not start invoice-request or any other module.

## Ground truth — build the backend to fit the EXISTING frontend model (frontend stays unchanged)

Read these before designing anything; the API contract must serve these shapes as-is:

- `apps/web/src/types/sales/shipment.types.ts`: `Shipment` with 7-state `ShipmentStatus` (`planned → picking → packed → shipped → signed → invoiced → closed`), optional multi-product `lines[]` (`ShipmentLine`: seq, productName, drawingNo, itemCode, batchNo, orderedQty, shippedQty, tailQty, amount) plus header aggregates, **tail quantity with `tailPlan: 'rework' | 'stock' | 'direct-stock' | 'scrap'`**, carrier/trackingNo/invoiceNo, `amount: Money`, and a `timeline: TimelineNode[]` of SHP-01…SHP-06 nodes.
- `apps/web/src/types/sales/statement.types.ts`: `Statement` per customer + period with `StatementStatus` (`draft → sent → confirmed | disputed → settled`), balances (opening / shipped / invoiced / received / return / closing), `differenceAmount` + mandatory `differenceNote` when non-zero, `overdueAmount`, and `lines[]` typed 发货/开票/回款/退货/折让 with a per-line `matched` flag.
- APIs already stubbed: `api/sales/shipment.api.ts` (`GET /shipments`, `POST /shipments/tail-plan`), `api/sales/statement.api.ts` (`GET /statements/customer`). Fixtures: `mock/sales/fulfilment.fixture.ts`, `statement.fixture.ts`. Extend the API files with the endpoints you add; keep `isMockEnabled()` fallback working.

If backend needs differ from these shapes, adapt the backend — the frontend is the baseline. Flag (don't silently change) anything truly impossible.

## Iron rule: MODULARITY (non-negotiable)

Mirror `services/api/src/modules/contract-order/` structure exactly (controllers ≤ 8 routes each / services / repositories / dto one-per-file / constants / events / `__tests__` / single `index.ts`). Cross-module access only via `index.ts` exports or domain events. File ≤ 400 lines, function ≤ 60. Reuse platform numbering, state-machine, audit, notification, timeline. TS strict; money = integer cents + currency in DB (serialize to the frontend's string shapes at the DTO mapper); quantities = decimal strings.

## Business rules to enforce (spec: docs/product/business-department-modules.md §7 + V2.4 尾数 rules)

1. **State machine** exactly the frontend's 7 states via platform state-machine; each transition audit-logged and reflected in the SHP-01~06 timeline (platform timeline service). No manual progress entry.
2. **Ship gate (at `packed → shipped`)**: block unless (a) QC release passes — consume via an exported read-port with a clearly-marked provider stub until the QMS module exists; and (b) **credit check** passes: customers with payment terms prepay/cash must be fully paid before shipping (receipts read-port, stub provider until finance lands). Blocking returns BizError listing the failed gate(s).
3. **Multi-line**: lines bind to `contract-order` order lines (via its `index.ts` exports); shipping writes back per-line shipped quantities and order status (partial/full) and emits `shipment.posted` (AR basis payload) and `shipment.signed` events.
4. **Tail quantity (尾数)**: tail = ordered − shipped per line; `POST /shipments/tail-plan` records one of the four paths (rework 返工补交 / stock 入库 / direct-stock 直接入库 / scrap 报废) with approval + audit; **closure balance check**: a shipment cannot reach `closed` until every line satisfies ordered = shipped + resolved-tail; rework path emits an event for the future rework module.
5. **Statements**: generated per customer + period **from source documents only** (shipments, invoices via seam, receipts via seam, returns via seam) — amounts never hand-editable; closing = opening + shipped/invoiced (per configured口径) − received − returns/allowances; non-zero `differenceAmount` requires `differenceNote`; status flow with `sent`/`confirmed`/`disputed` transitions audit-logged; per-line `matched` updateable; regeneration creates a new version, never mutates a sent statement. Export stays through the existing export helper (the `docgen` module takes over later — keep the seam).
6. `doc_no` from platform numbering for both document types; optimistic locking; status-transition audit with actor/timestamp/duration throughout.

## Definition of done

Prisma migration + seeds (reuse warehouse/customer seeds); unit tests on every service — branch coverage ≥ 90% on the ship-gate service (QC × credit combinations), tail-closure balance check, and statement aggregation/versioning; endpoints per `docs/api/api-conventions.md`; register module + row in the dev-guide module table; frontend wired to real API with mock fallback intact and pages unchanged; `pnpm lint`, `pnpm typecheck`, all tests green (`tools/check_repository.py` runs locally only — skip if not a git checkout). Conventional Commits (`feat(shipment): ...`). Do NOT run git push. **Stop after green — do not begin invoice-request.**
