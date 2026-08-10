import { ObjectStorageService } from '../../src/platform/object-storage'

import type { PrismaClient } from '@prisma/client'

/**
 * 在线预览的样例文件（deployment-environment.md 第 3 章的冒烟路径）。
 *
 * 本任务**不做上传**——真正的图纸上传属于报价流程，带着「申请报价时必传」
 * 「版本递增」「对象键带版本号做缓存失效」这些业务规则，那是后续
 * `drawing-upload` 任务的事。这里只把两个样例对象放进 MinIO 并建好指向它们的行，
 * 让 resolver → 鉴权 → 预签名 → Base64 → 水印这条链路能被真实点开验证。
 *
 * MinIO 没起也不让整个 seed 失败：预览是演示项，数据库种子不该被它拖住。
 */
const SAMPLE_DRAWING_KEY = 'drawings/MT-7719/REV-B/MT-7719_REV-B.pdf'
const SAMPLE_PO_KEY = 'orders/customer-po/PO-88712.pdf'

/** 一个能被 kkFileView 正常渲染的最小 PDF（不依赖任何外部素材）。 */
function samplePdf(title: string): Uint8Array {
  const content = `BT /F1 18 Tf 72 720 Td (${title}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefAt = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

async function putSamples(): Promise<boolean> {
  const storage = new ObjectStorageService()
  try {
    await storage.putObject(SAMPLE_DRAWING_KEY, samplePdf('MT-7719 REV B - sample drawing'), 'application/pdf')
    await storage.putObject(SAMPLE_PO_KEY, samplePdf('PO-88712 - sample customer PO'), 'application/pdf')
    return true
  } catch (error) {
    console.warn(
      `  ! MinIO 不可达，跳过样例文件写入（预览需要先 docker compose -f infra/docker-compose.local.yml up -d）：${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return false
  }
}

export async function seedPreviewSamples(prisma: PrismaClient): Promise<void> {
  const uploaded = await putSamples()

  const customer = await prisma.customer.findFirst({ orderBy: { code: 'asc' } })
  if (!customer) return

  const drawing = await prisma.drawing.upsert({
    where: { drawingNo_customerId: { drawingNo: 'MT-7719', customerId: customer.id } },
    create: {
      drawingNo: 'MT-7719',
      customerId: customer.id,
      title: '直线导轨安装座',
      createdBy: 'SEED',
    },
    update: {},
  })

  await prisma.drawingVersion.upsert({
    where: { drawingId_sequence: { drawingId: drawing.id, sequence: 1 } },
    create: {
      drawingId: drawing.id,
      revision: 'REV B',
      sequence: 1,
      // 对象键带版本号：图纸出新版时键也变，避免命中 kkFileView 的旧转换缓存
      fileKey: SAMPLE_DRAWING_KEY,
      fileName: 'MT-7719_REV-B.pdf',
      fileSize: 1024,
      uploadedBy: 'SEED',
    },
    update: { fileKey: SAMPLE_DRAWING_KEY, fileName: 'MT-7719_REV-B.pdf' },
  })

  // 一张订单挂上客户订单原件，覆盖第二种归属类型
  const order = await prisma.salesOrder.findFirst({ orderBy: { docNo: 'asc' } })
  if (order) {
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { customerPoFile: SAMPLE_PO_KEY },
    })
  }

  console.log(
    uploaded
      ? '  · 样例文件已写入 MinIO，可在报价/BOM/订单页点「预览」验证 kkFileView'
      : '  · 已建好指向样例文件的记录；起 MinIO 后重跑本 seed 即可写入文件本体',
  )
}
