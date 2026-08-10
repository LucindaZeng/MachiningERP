import { BizError } from '../biz-error'

import type { PreviewUrlView } from '../file-preview.api'

/**
 * 预览的 mock：不起 kkFileView 容器也能把对话框演示出来。
 *
 * 返回一个自包含的 data: URL 页面，iframe 直接能渲染，
 * 页面上写清「这是 mock」以及真实链路会是什么样——
 * 免得演示时被误认为 kkFileView 真的跑起来了。
 */
const SAMPLES: Record<string, { fileName: string; unsupported?: boolean }> = {
  'drawing-version': { fileName: 'MT-7719_REV-B.pdf' },
  'order-customer-po': { fileName: 'PO-88712.pdf' },
}

const WATERMARK = '陈志强 WFX-2018-0042'

export function mockPreviewUrl(ownerType: string, ownerId: string): PreviewUrlView {
  const sample = SAMPLES[ownerType]
  if (!sample) {
    throw new BizError({ code: 'SYS_9031', message: '未知的文件归属类型', status: 400 })
  }

  // 演示 415 回落：ownerId 以 .step 结尾时假装是不支持的类型
  if (ownerId.endsWith('.step')) {
    throw new BizError({
      code: 'SYS_9032',
      message: `${ownerId} 不支持在线预览，请下载后查看`,
      status: 415,
    })
  }

  return {
    previewUrl: placeholderPage(sample.fileName, ownerType, ownerId),
    fileName: sample.fileName,
    expiresInSeconds: 180,
    watermarkText: WATERMARK,
  }
}

export function mockDownloadUrl(ownerType: string): PreviewUrlView {
  const sample = SAMPLES[ownerType]
  return {
    previewUrl: placeholderPage(sample?.fileName ?? 'file', ownerType, '（下载占位）'),
    fileName: sample?.fileName ?? 'file',
    expiresInSeconds: 180,
    watermarkText: '',
  }
}

/** 自包含占位页；水印用 CSS 斜纹铺满，视觉上与真实预览一致。 */
function placeholderPage(fileName: string, ownerType: string, ownerId: string): string {
  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>${fileName}</title>
<style>
 body{margin:0;font:14px/1.7 -apple-system,"PingFang SC",sans-serif;color:#1f2937;
   background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh}
 .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:28px 34px;max-width:520px}
 h1{margin:0 0 12px;font-size:17px}
 code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12.5px}
 ul{margin:12px 0 0;padding-left:18px;color:#475569;font-size:13px}
 .mark{position:fixed;inset:0;pointer-events:none;display:grid;
   grid-template-columns:repeat(3,1fr);place-items:center;
   font-size:20px;color:rgba(15,23,42,.07);transform:rotate(-24deg)}
</style></head><body>
<div class="mark">${Array.from({ length: 9 }, () => `<span>${WATERMARK}</span>`).join('')}</div>
<div class="card">
  <h1>预览占位页（mock 模式）</h1>
  <p>文件：<code>${fileName}</code>　归属：<code>${ownerType}</code> / <code>${ownerId}</code></p>
  <ul>
    <li>真实环境下这里是 kkFileView 渲染的文件本体</li>
    <li>后端签发 5 分钟内有效的 MinIO 预签名 URL，先 Base64 再 URL 编码后交给 kkFileView</li>
    <li>水印取当前登录人的姓名 + 工号，每次签发都写审计</li>
    <li>起容器：<code>docker compose -f infra/docker-compose.local.yml up -d</code></li>
  </ul>
</div></body></html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}
