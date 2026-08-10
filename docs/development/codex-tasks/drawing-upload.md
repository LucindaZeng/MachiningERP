# Codex Task: `drawing-upload` — real upload for quotation drawings & order customer-PO

> Status: **pending — next in queue**. Ground truth verified 2026-08-11: QuoteApplyDialog's 上传图纸 button and use-sales-order-form's PO upload are both placeholders; types (`DrawingFile`, `drawingVersionId`, `customerPoFile`) already prepared; platform `object-storage` provider available from file-preview.

ONE step only. After this, the queue resumes: invoice-request → sales-return → customs → sales-analytics → docgen → ecn-request → final mock-to-API sweep.

## Context — current placeholders (verified)

- `pages/sales/quotations/components/QuoteApplyDialog.vue`: an「上传图纸（PDF / STEP）」button (`pickDrawing`) that only records a name; submission is already blocked with 「未上传图纸，无法提交报价申请」 when absent — the gate text exists, the upload doesn't.
- `composables/use-sales-order-form.ts` line ~43: PO "upload" fabricates a filename (`form.poFile = ...`) and toasts success — pure placeholder.
- Types already prepared: `quotation.types.ts` has `DrawingFile` and `drawingVersionId?`; `order.types.ts` has `customerPoNo`/`customerPoFile`/`poFile`.
- Platform `object-storage` provider (S3 client + audience-aware presign) shipped in file-preview — **reuse it; do not touch the SDK directly from business modules.**

## Scope

1. **Quotation drawing upload** (spec §2.2): multipart upload endpoint in the `quotation` module (storage access only via the platform provider). On upload: create or increment `DrawingVersion` — **object key carries the version** (kkFileView conversion-cache busting), populate `fileKey`/`fileName`. Mandatory gate server-side: a quote application without a drawing is rejected (the frontend text becomes true). One upload, reused downstream: costing and BOM read the same `DrawingVersion` — re-upload anywhere downstream stays forbidden.
2. **Order customer-PO upload** (spec §4.1): multipart endpoint in `contract-order`; populates `SalesOrder.customerPoFile` (keep the bare-column model — no new table). Server-side mandatory gate: mold + normal orders, and paid samples, cannot be submitted without it; free samples and stock-prep orders exempt.
3. **Frontend**: replace both placeholders with real uploads (progress + failure state), wiring through the existing composable/API layering; after upload, the file-preview dialog must work on the fresh object (drawing via `drawing-version`, PO via `order-customer-po`). Mock fallback intact.

## Validation & audit

Extension allowlist (pdf/dwg/dxf/step/jpg/png/xlsx/docx/zip — one shared constant with file-preview's allowlist, single source of truth), size limit via env, content-type sniff; audit every upload (who / owning document / version). Uploaded objects are immutable — a corrected drawing is a NEW version, never an overwrite.

## Iron rule: MODULARITY (non-negotiable)

Upload endpoints live in their owning business modules; storage only via the platform `object-storage` export; no business module imports another's internals; file ≤ 400 lines, function ≤ 60, controller ≤ 8 routes; TS strict.

## DoD

Unit tests: mandatory-gate (quote application & the three order types), version increment + key composition, allowlist/size rejection — branch coverage ≥ 90% on upload services; `pnpm lint`, `pnpm typecheck`, all tests green; migration generated locally by the user if schema changes. Conventional Commits (`feat(drawing-upload): ...`). Do NOT run git push. **Stop after green — do not begin invoice-request.**
