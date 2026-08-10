# Codex Task: `file-preview` platform capability (kkFileView integration)

> Status: **done (2026-08-11)**. Shipped as TWO platform capabilities: `object-storage` (S3 client + presign, audience-aware: preview→S3_PREVIEW_ENDPOINT / browser→S3_ENDPOINT, deliberately NO fallback between them) and `file-preview` (registry, URL composition, audit). Accepted additions beyond brief: `download-url` endpoint (415 fallback target, audited as `file-preview.download`) and pre-sign extension allowlist. Authz denial returns 404 (indistinguishable from not-found). DI fixed with explicit config tokens. 100% branch on both services; 932 tests green. Local steps: `prisma migrate dev` + `prisma db seed`（seed 在 MinIO 未启动时跳过写入并告警）.
>
> Original decision log — Decision (2026-08-11): file identity = resolver registry keyed by `(ownerType, ownerId)` — `drawing-version` and `order-customer-po` resolvers only; shipment attachments out of scope (no data yet); no generic FileObject table now — migrate to one when a third file kind appears (registry interface unchanged). Scope decision 2: preview only — no upload endpoint; seed script writes sample objects to MinIO and populates `DrawingVersion.fileKey` + one `customerPoFile`; smoke path = seed → preview. S3 client wiring goes in a reusable platform `object-storage` provider. Independent of the sales-module queue — may run between any two modules. Design doc: `docs/development/deployment-environment.md` §3 — follow it exactly.

ONE step only.

## Backend

`services/api/src/platform/file-preview/` (or a small module mirroring platform-service conventions): `GET /files/:ownerType/:ownerId/preview-url` — resolver registry per owner type (`drawing-version`, `order-customer-po`); each resolver runs the owner document's authz then returns `{fileKey, fileName}`, then issue a short-TTL (≤ 5 min) MinIO presigned URL whose endpoint is reachable by the kkFileView container (`S3_PREVIEW_ENDPOINT`, defaults to the internal service name — NOT localhost), and return:

```
{KK_PREVIEW_BASE_URL}/onlinePreview?url=<urlencode(base64(presignedUrl))>&fullfilename=<name>&watermarkTxt=<userName+userCode>
```

(kkFileView 4.x requires the file URL to be Base64-encoded then URL-encoded.) Log every preview issuance to the audit trail. Config via env (`KK_PREVIEW_BASE_URL`), never hard-coded. Unit tests: authz denial, TTL, base64+urlencode correctness, watermark composition.

## Frontend (`apps/web`)

One reusable `FilePreviewDialog.vue` (iframe + open-in-new-tab + download fallback when the API returns 415/unsupported), wired into the existing drawing/attachment links in quotations, BOM requests, orders, and shipments — pages otherwise unchanged; mock fallback returns a placeholder.

## Notes

- kkFileView runs as a container (`infra/docker-compose.local.yml` service `kkfileview`), intranet-only; production exposes it via Nginx `/preview/` with `KK_BASE_URL` set accordingly.
- Drawing versions must map to distinct object keys (version in the key) so kkFileView's conversion cache never serves a stale drawing.

Iron rule (modularity), lint/typecheck/tests green, Conventional Commits, no git push. Stop when green.
