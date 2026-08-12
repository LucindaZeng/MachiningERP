/**
 * 新建七份受控模板（一次性脚本，留档以便复现）。
 *
 * 与 author-example-templates.mjs 的区别：那三份有客户手上的原件可以派生，
 * 这七份没有——对账单、报关四件套与两张合并比较表都是本系统首次出具的单据，
 * 版式由这里定下来，此后**以 .xlsx 文件为准**，改版式改文件不改代码。
 *
 * 用法：node tools/docgen/author-new-templates.mjs
 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ExcelJS = createRequire(import.meta.url)(
  createRequire(`${root}/services/api/package.json`).resolve('exceljs'),
)
const outDir = resolve(root, 'services/api/src/modules/docgen/templates')

const COMPANY = '东莞市万富鑫智能装备有限公司'
const COMPANY_EN = 'Wanfuxin Intelligent Equipment Co., Ltd.'
const THIN = { style: 'thin', color: { argb: 'FF999999' } }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } }

/** 表格列定义：宽度、表头文字、明细行标记。 */
function table(sheet, startRow, columns) {
  const head = sheet.getRow(startRow)
  const body = sheet.getRow(startRow + 1)

  columns.forEach((column, index) => {
    const position = index + 1
    sheet.getColumn(position).width = column.width
    const headCell = head.getCell(position)
    headCell.value = column.head
    headCell.font = { bold: true, size: 10 }
    headCell.fill = HEAD_FILL
    headCell.border = BORDER
    headCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    const bodyCell = body.getCell(position)
    bodyCell.value = column.cell
    bodyCell.font = { size: 10 }
    bodyCell.border = BORDER
    bodyCell.alignment = { vertical: 'middle', horizontal: column.align ?? 'left', wrapText: true }
    if (column.numFmt) bodyCell.numFmt = column.numFmt
  })

  head.height = 26
  body.height = 22
  return startRow + 2
}

/** 抬头：公司名 + 单据名（中英双行），横跨整表。 */
function title(sheet, span, chinese, english) {
  sheet.mergeCells(`A1:${span}1`)
  const company = sheet.getCell('A1')
  company.value = `${COMPANY}\u3000${COMPANY_EN}`
  company.font = { bold: true, size: 11, color: { argb: 'FF1F3864' } }
  company.alignment = { horizontal: 'center' }

  sheet.mergeCells(`A2:${span}2`)
  const heading = sheet.getCell('A2')
  heading.value = english ? `${chinese}\u3000${english}` : chinese
  heading.font = { bold: true, size: 16 }
  heading.alignment = { horizontal: 'center' }
  sheet.getRow(2).height = 28
}

/** 表头信息块：左右两栏 label:value，返回下一个可用行号。 */
function metaBlock(sheet, startRow, span, pairs) {
  const half = Math.ceil(pairs.length / 2)
  const middle = Math.ceil(columnNumber(span) / 2)

  pairs.forEach((pair, index) => {
    const row = startRow + (index % half)
    const column = index < half ? 1 : middle + 1
    const cell = sheet.getRow(row).getCell(column)
    cell.value = `${pair[0]}：${pair[1]}`
    cell.font = { size: 10 }
    sheet.mergeCells(row, column, row, column + middle - 1)
  })

  return startRow + half + 1
}

function columnNumber(letters) {
  return [...letters].reduce((value, letter) => value * 26 + (letter.charCodeAt(0) - 64), 0)
}

/** 表尾说明与签署栏。 */
function footer(sheet, startRow, span, notes) {
  notes.forEach((note, index) => {
    const row = startRow + index
    sheet.mergeCells(`A${row}:${span}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = note
    cell.font = { size: 9, color: { argb: 'FF666666' } }
    cell.alignment = { wrapText: true, vertical: 'top' }
  })
}

async function write(fileName, build) {
  const book = new ExcelJS.Workbook()
  book.creator = 'MachiningERP docgen'
  build(book)
  mkdirSync(outDir, { recursive: true })
  await book.xlsx.writeFile(resolve(outDir, fileName))
  console.log(`✓ ${fileName}`)
}

/* ------------------------------ 对账单 ------------------------------ */

await write('statement.xlsx', (book) => {
  const sheet = book.addWorksheet('对账单')
  title(sheet, 'H', '客户对账单', 'Statement of Account')
  const afterMeta = metaBlock(sheet, 4, 'H', [
    ['对账单号', '{{docNo}}'],
    ['客户', '{{customer.name}}'],
    ['对账期间', '{{periodFrom}} ~ {{periodTo}}'],
    ['汇总口径', '{{basisLabel}}'],
    ['币种', '{{currency}}'],
    ['业务员', '{{owner.name}}'],
  ])

  const afterTable = table(sheet, afterMeta, [
    { width: 6, head: '序号', cell: '{{*lines.#}}', align: 'center' },
    { width: 13, head: '单据日期', cell: '{{*lines.docDate}}', align: 'center' },
    { width: 20, head: '单据号', cell: '{{*lines.docNo}}' },
    { width: 12, head: '类型', cell: '{{*lines.typeLabel}}', align: 'center' },
    { width: 26, head: '产品 / 说明', cell: '{{*lines.description}}' },
    { width: 12, head: '数量', cell: '{{*lines.quantity}}', align: 'right' },
    { width: 15, head: '金额', cell: '{{*lines.amount}}', align: 'right', numFmt: '#,##0.00' },
    { width: 18, head: '备注', cell: '{{*lines.remark}}' },
  ])

  const totals = [
    ['本期出货合计', '{{totals.shipped}}'],
    ['退货与折让', '{{totals.deduction}}'],
    ['本期应收合计', '{{totals.receivable}}'],
    ['客户结算金额', '{{totals.customerClosing}}'],
    ['差异', '{{totals.difference}}'],
  ]
  totals.forEach((pair, index) => {
    const row = afterTable + index
    sheet.mergeCells(`E${row}:F${row}`)
    const label = sheet.getCell(`E${row}`)
    label.value = pair[0]
    label.font = { bold: index === 2, size: 10 }
    label.alignment = { horizontal: 'right' }
    const value = sheet.getCell(`G${row}`)
    value.value = pair[1]
    value.font = { bold: index === 2, size: 10 }
    value.numFmt = '#,##0.00'
    value.border = BORDER
    value.alignment = { horizontal: 'right' }
  })

  footer(sheet, afterTable + totals.length + 1, 'H', [
    '差异说明：{{differenceNote}}',
    '本对账单由系统按所选口径汇总生成。请于收到后 7 个工作日内确认或提出异议；逾期未回复视同确认。',
    '未结案的退货申请不计入本期金额，仅作为争议事项另行说明——已发生但未定案的钱不该出现在对账数字里。',
  ])
})

/* ------------------------------ 报关四件套 ------------------------------ */

/** 形式发票与商业发票共用一套版式：字段完全相同，差别只在抬头与出具时点。 */
await write('customs-invoice.xlsx', (book) => {
  const sheet = book.addWorksheet('INVOICE')
  title(sheet, 'H', '{{docTitleCn}}', '{{docTitleEn}}')
  const afterMeta = metaBlock(sheet, 4, 'H', [
    ['Invoice No', '{{docNo}}'],
    ['Date', '{{issuedOn}}'],
    ['Consignee', '{{customer.name}}'],
    ['Address', '{{customer.address}}'],
    ['Incoterm', '{{incoterm}}'],
    ['Port of Loading', '{{portOfLoading}}'],
    ['Destination', '{{destination}}'],
    ['Shipping Marks', '{{shippingMarks}}'],
  ])

  const afterTable = table(sheet, afterMeta, [
    { width: 6, head: 'No.', cell: '{{*lines.#}}', align: 'center' },
    { width: 30, head: 'Description of Goods\n品名', cell: '{{*lines.description}}' },
    { width: 14, head: 'HS Code', cell: '{{*lines.hsCode}}', align: 'center' },
    { width: 12, head: 'Qty', cell: '{{*lines.quantity}}', align: 'right' },
    { width: 8, head: 'Unit', cell: '{{*lines.unit}}', align: 'center' },
    {
      width: 14,
      head: 'Unit Price',
      cell: '{{*lines.unitPrice}}',
      align: 'right',
      numFmt: '#,##0.0000',
    },
    { width: 16, head: 'Amount', cell: '{{*lines.amount}}', align: 'right', numFmt: '#,##0.00' },
    { width: 16, head: 'Remark', cell: '{{*lines.remark}}' },
  ])

  sheet.mergeCells(`A${afterTable}:F${afterTable}`)
  sheet.getCell(`A${afterTable}`).value = 'TOTAL　合计（{{currency}}）'
  sheet.getCell(`A${afterTable}`).font = { bold: true, size: 10 }
  sheet.getCell(`A${afterTable}`).alignment = { horizontal: 'right' }
  sheet.getCell(`G${afterTable}`).value = '{{totalAmount}}'
  sheet.getCell(`G${afterTable}`).font = { bold: true, size: 10 }
  sheet.getCell(`G${afterTable}`).numFmt = '#,##0.00'
  sheet.getCell(`G${afterTable}`).border = BORDER

  footer(sheet, afterTable + 2, 'H', [
    'Net Weight / 净重：{{netWeight}} KG　　Gross Weight / 毛重：{{grossWeight}} KG　　Packages / 件数：{{packages}}',
    'Exchange Rate / 汇率快照：{{exchangeRate}}　　Version / 版本：V{{version}}',
    'Beneficiary：' + COMPANY_EN,
    '本件由系统按登记要素出具；每次出具均为新版本，旧版原样留存并各自保留出具当时的汇率快照。',
  ])
})

await write('customs-packing-list.xlsx', (book) => {
  const sheet = book.addWorksheet('PACKING LIST')
  title(sheet, 'H', '装箱单', 'Packing List')
  const afterMeta = metaBlock(sheet, 4, 'H', [
    ['Packing List No', '{{docNo}}'],
    ['Date', '{{issuedOn}}'],
    ['Consignee', '{{customer.name}}'],
    ['Shipping Marks', '{{shippingMarks}}'],
    ['Port of Loading', '{{portOfLoading}}'],
    ['Destination', '{{destination}}'],
  ])

  const afterTable = table(sheet, afterMeta, [
    { width: 6, head: 'No.', cell: '{{*lines.#}}', align: 'center' },
    { width: 32, head: 'Description of Goods\n品名', cell: '{{*lines.description}}' },
    { width: 12, head: 'Qty', cell: '{{*lines.quantity}}', align: 'right' },
    { width: 8, head: 'Unit', cell: '{{*lines.unit}}', align: 'center' },
    { width: 12, head: 'Packages\n件数', cell: '{{*lines.packages}}', align: 'right' },
    { width: 14, head: 'N.W.(KG)', cell: '{{*lines.netWeight}}', align: 'right' },
    { width: 14, head: 'G.W.(KG)', cell: '{{*lines.grossWeight}}', align: 'right' },
    { width: 16, head: 'Measurement', cell: '{{*lines.measurement}}' },
  ])

  footer(sheet, afterTable + 1, 'H', [
    'TOTAL：{{packages}} packages　　N.W. {{netWeight}} KG　　G.W. {{grossWeight}} KG',
    '装箱单按**实发数量**出具，与商业发票同源；形式发票不参与装箱口径。',
  ])
})

await write('customs-contract.xlsx', (book) => {
  const sheet = book.addWorksheet('CONTRACT')
  title(sheet, 'G', '出口销售合同', 'Sales Contract')
  const afterMeta = metaBlock(sheet, 4, 'G', [
    ['Contract No', '{{docNo}}'],
    ['Date', '{{issuedOn}}'],
    ['Seller', COMPANY_EN],
    ['Buyer', '{{customer.name}}'],
    ['Trade Mode', '{{tradeMode}}'],
    ['Incoterm', '{{incoterm}}'],
  ])

  const afterTable = table(sheet, afterMeta, [
    { width: 6, head: 'No.', cell: '{{*lines.#}}', align: 'center' },
    { width: 34, head: 'Commodity / 品名', cell: '{{*lines.description}}' },
    { width: 14, head: 'HS Code', cell: '{{*lines.hsCode}}', align: 'center' },
    { width: 12, head: 'Qty', cell: '{{*lines.quantity}}', align: 'right' },
    { width: 8, head: 'Unit', cell: '{{*lines.unit}}', align: 'center' },
    {
      width: 14,
      head: 'Unit Price',
      cell: '{{*lines.unitPrice}}',
      align: 'right',
      numFmt: '#,##0.0000',
    },
    { width: 16, head: 'Amount', cell: '{{*lines.amount}}', align: 'right', numFmt: '#,##0.00' },
  ])

  footer(sheet, afterTable + 1, 'G', [
    'Total Contract Value：{{totalAmount}} {{currency}}',
    'Port of Loading：{{portOfLoading}}　　Destination：{{destination}}　　Destination Port Code：{{destinationPortCode}}',
    'Terms of Payment / 付款方式：{{paymentTerms}}',
    'Seller　卖方：' + COMPANY + '　　　　Buyer　买方：{{customer.name}}',
  ])
})

await write('customs-data-pack.xlsx', (book) => {
  const sheet = book.addWorksheet('报关数据包')
  title(sheet, 'F', '报关单要素表', 'Customs Declaration Data Pack')
  const afterMeta = metaBlock(sheet, 4, 'F', [
    ['报关资料号', '{{docNo}}'],
    ['出具日期', '{{issuedOn}}'],
    ['关联发货单', '{{shipmentNo}}'],
    ['关联订单', '{{orderNo}}'],
    ['申报版本', 'V{{declarationVersion}}'],
    ['汇率快照', '{{exchangeRate}}'],
  ])

  const afterElements = table(sheet, afterMeta, [
    { width: 8, head: '序号', cell: '{{*elements.#}}', align: 'center' },
    { width: 24, head: '申报要素', cell: '{{*elements.label}}' },
    { width: 34, head: '内容', cell: '{{*elements.value}}' },
    { width: 12, head: '单位', cell: '{{*elements.unit}}', align: 'center' },
    { width: 14, head: '数值', cell: '{{*elements.amount}}', align: 'right' },
    { width: 18, head: '备注', cell: '{{*elements.remark}}' },
  ])

  const manifestHead = afterElements + 1
  sheet.mergeCells(`A${manifestHead}:F${manifestHead}`)
  sheet.getCell(`A${manifestHead}`).value = '随附单证清单（申报冻结快照）'
  sheet.getCell(`A${manifestHead}`).font = { bold: true, size: 11 }

  const afterManifest = table(sheet, manifestHead + 1, [
    { width: 8, head: '序号', cell: '{{*manifest.#}}', align: 'center' },
    { width: 24, head: '模板编码', cell: '{{*manifest.templateCode}}' },
    { width: 34, head: '文件', cell: '{{*manifest.name}}' },
    { width: 12, head: '版本', cell: '{{*manifest.version}}', align: 'center' },
    { width: 14, head: '出具日期', cell: '{{*manifest.issuedOn}}', align: 'center' },
    { width: 18, head: '备注', cell: '{{*manifest.remark}}' },
  ])

  footer(sheet, afterManifest + 1, 'F', [
    '本数据包引用**商业发票**（按实发数出具），不引用形式发票。',
    '申报即冻结本页清单快照；此后任何改动都须填写理由走更正并重报，更正记录附后。',
  ])
})

/* ------------------------------ 合并比较表 ------------------------------ */

/**
 * 多选合并导出：**摊平成一行一明细**，不做「一份单据一块」的嵌套区域。
 *
 * 理由：合并导出的用途是横向比价与复核。一张能排序、能筛选、能透视的平表
 * 才做得到这件事；把每份单据渲染成一块，得到的是把 N 份 PDF 粘在一张纸上，
 * 排序一下就散架了。单据身份靠前几列重复带出。
 */
await write('quotation-merge.xlsx', (book) => {
  const sheet = book.addWorksheet('报价合并比较')
  title(sheet, 'L', '报价单合并比较表', 'Quotation Comparison')
  const afterMeta = metaBlock(sheet, 4, 'L', [
    ['导出时间', '{{exportedOn}}'],
    ['导出人', '{{owner.name}}'],
    ['单据份数', '{{documentCount}}'],
    ['明细行数', '{{lineCount}}'],
  ])

  const afterTable = table(sheet, afterMeta, [
    { width: 18, head: '报价单号', cell: '{{*rows.docNo}}' },
    { width: 8, head: '版本', cell: '{{*rows.version}}', align: 'center' },
    { width: 22, head: '客户', cell: '{{*rows.customerName}}' },
    { width: 10, head: '状态', cell: '{{*rows.statusLabel}}', align: 'center' },
    { width: 24, head: '产品名称', cell: '{{*rows.productName}}' },
    { width: 16, head: '图号', cell: '{{*rows.drawingNo}}' },
    { width: 14, head: '材质', cell: '{{*rows.material}}' },
    { width: 14, head: '起订量', cell: '{{*rows.minQuantity}}', align: 'right' },
    { width: 14, head: '单价', cell: '{{*rows.unitPrice}}', align: 'right', numFmt: '#,##0.0000' },
    { width: 10, head: '币种', cell: '{{*rows.currency}}', align: 'center' },
    { width: 14, head: '模具费', cell: '{{*rows.moldFee}}', align: 'right', numFmt: '#,##0.00' },
    { width: 14, head: '有效期至', cell: '{{*rows.validUntil}}', align: 'center' },
  ])

  footer(sheet, afterTable + 1, 'L', [
    '一行一个价格档：同一产品有几档起订量就有几行，因此**不要对单价列直接求和**。',
    '单价为业务员最终报价；成本快照不在本表，需要时导出成本分析合并表。',
  ])
})

await write('cost-analysis-merge.xlsx', (book) => {
  const sheet = book.addWorksheet('成本分析合并比较')
  title(sheet, 'L', '成本分析合并比较表', 'Cost Analysis Comparison')
  const afterMeta = metaBlock(sheet, 4, 'L', [
    ['导出时间', '{{exportedOn}}'],
    ['导出人', '{{owner.name}}'],
    ['单据份数', '{{documentCount}}'],
    ['明细行数', '{{lineCount}}'],
  ])

  const afterTable = table(sheet, afterMeta, [
    { width: 18, head: '成本分析号', cell: '{{*rows.docNo}}' },
    { width: 8, head: '版本', cell: '{{*rows.version}}', align: 'center' },
    { width: 22, head: '客户', cell: '{{*rows.customerName}}' },
    { width: 18, head: '产品型号', cell: '{{*rows.productModel}}' },
    { width: 20, head: '名称图号', cell: '{{*rows.drawingNo}}' },
    { width: 14, head: '材质', cell: '{{*rows.material}}' },
    { width: 12, head: '数量', cell: '{{*rows.quantity}}', align: 'right' },
    {
      width: 14,
      head: '材料金额',
      cell: '{{*rows.materialAmount}}',
      align: 'right',
      numFmt: '#,##0.00',
    },
    {
      width: 14,
      head: '加工金额',
      cell: '{{*rows.machiningAmount}}',
      align: 'right',
      numFmt: '#,##0.00',
    },
    { width: 14, head: '合计金额', cell: '{{*rows.subtotal}}', align: 'right', numFmt: '#,##0.00' },
    {
      width: 14,
      head: '含税金额',
      cell: '{{*rows.totalWithTax}}',
      align: 'right',
      numFmt: '#,##0.00',
    },
    { width: 10, head: '币种', cell: '{{*rows.currency}}', align: 'center' },
  ])

  footer(sheet, afterTable + 1, 'L', [
    '金额口径与单份成本分析一致，由后端 calculateCostAnalysis 算出——本表不含公式，避免两处算法各算各的。',
    '费率（损耗 / 管理费利润 / 税率）逐单可调，跨单比较时请一并核对各自的费率。',
  ])
})
