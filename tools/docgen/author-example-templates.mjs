/**
 * 从 example/ 里的真实样单派生出三份**受控模板**（一次性脚本，留档以便复现）。
 *
 * 为什么要留这个脚本而不是只把 .xlsx 提交进去：模板是二进制，diff 看不出改了什么。
 * 有了它，「模板是怎么从客户手上那份样单变过来的」这件事就是可读、可重跑的。
 *
 * 做的事：
 *   1. 老 .xls 先经 LibreOffice 转成 .xlsx（ExcelJS 读不了 BIFF8 二进制）；
 *   2. 只留一张工作表，删掉样单里的其余页；
 *   3. 把样例数据替换成 {{标记}}，样式、合并、logo 一概不动；
 *   4. 多余的样例数据行删掉，只留一行作为重复行模板。
 *
 * 用法：node tools/docgen/author-example-templates.mjs
 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// pnpm 的 node_modules 是软链结构，写死相对路径找不到；从 api 包的位置解析
const ExcelJS = createRequire(import.meta.url)(
  createRequire(`${root}/services/api/package.json`).resolve('exceljs'),
)
const outDir = resolve(root, 'services/api/src/modules/docgen/templates')
const converted = resolve(root, '.tmp/docgen-convert')

/** 国内报价单：阶梯报价版（MOQ 两档），条款区用 ⊙/○ 勾选标记。 */
const DOMESTIC = {
  source: `${converted}/国内报价单.xlsx`,
  keepSheet: '深圳市美思先端电子有限公司',
  renameTo: '报价单',
  out: 'quotation-domestic.xlsx',
  deleteRows: [13],
  cells: {
    K4: '{{quotedOn}}',
    C5: '{{customer.name}}',
    C6: '{{customer.contact}}',
    C7: '{{customer.phone}}',
    C8: '{{customer.fax}}',
    C9: '{{customer.email}}',
    C10: '{{customer.address}}',
    J6: '{{owner.name}}',
    J7: '{{owner.phone}}',
    J9: '{{owner.email}}',
    I11: 'MOQ:{{tierLabel1}}',
    J11: 'MOQ:{{tierLabel2}}',
    A12: '{{*items.#}}',
    B12: '{{*items.productName}}',
    H12: '{{*items.process}}',
    I12: '{{*items.tier1}}',
    J12: '{{*items.tier2}}',
    K12: '{{*items.remark}}',
    D14: '{{?currency=CNY}}RMB',
    H14: '{{?currency=USD}}USD',
    K14: '{{?currency=HKD}}HKD',
    D15: '{{?terms.processingMode=包工包料}}代工代料',
    H15: '{{?terms.processingMode=来料加工}}代工不代料',
    D16: '{{?terms.paymentTerms=现金}}现金　{{?terms.paymentTerms=月结30天}}月结30天　{{?terms.paymentTerms=预付货款}}预付货款',
    D17: '{{?terms.allowedScrapBps=500}}5%',
    F17: '{{?terms.allowedScrapBps=300}}3%',
    D18: '{{?terms.scrapReturned=false}}不退还',
    F18: '{{?terms.scrapReturned=true}}退还客户____%',
    D19: '{{?validDays=15}}15天',
    F19: '{{?validDays=30}}30天',
    H19: '{{?validDays=60}}60天',
    D20: '{{terms.remark}}',
    L24: '{{owner.name}}',
  },
}

/** 国外报价单：英文抬头 + 四档 MOQ + Tolling（模具费单列，不摊进单价）。 */
const OVERSEAS = {
  source: resolve(root, 'example/报价单模板/国外报价单.xlsx'),
  keepSheet: 'Quotation',
  renameTo: 'Quotation',
  out: 'quotation-overseas.xlsx',
  deleteRows: [],
  cells: {
    A3: '{{quotedOn}}',
    D5: '{{customer.name}}',
    D6: '{{customer.address}}',
    F12: '{{tierLabel1}}',
    G12: '{{tierLabel2}}',
    H12: '{{tierLabel3}}',
    I12: '{{tierLabel4}}',
    J12: '{{tierLabel5}}',
    A13: '{{*items.productName}}',
    C13: '{{*items.revision}}',
    D13: '{{*items.material}}',
    E13: '{{*items.finishing}}',
    F13: '{{*items.tier1}}',
    G13: '{{*items.tier2}}',
    H13: '{{*items.tier3}}',
    I13: '{{*items.tier4}}',
    J13: '{{*items.tier5}}',
    K13: '{{*items.moldFee}}',
    L13: '{{*items.remark}}',
  },
}

/**
 * CNC 成本分析：工艺列可加减，因此工艺列的表头也是标记。
 *
 * ⚠️ 明细行原本带公式（`=H5-I5`、`=Y5*1.13` …），这里**全部换成标记**。
 * 两个理由：一是 ExcelJS 复制行时公式里的行号不会跟着走，第 6 行会照抄
 * `=H5-I5`，客户拿到的成本表会全是错数；二是这些数后端 `calculateCostAnalysis`
 * 已经算过且有测试盯着，让 Excel 再算一遍就有了两个真相，
 * 而表头上的 5%／13% 还是记录里可调的费率——两边迟早对不上。
 */
const COST = {
  source: `${converted}/CNC成本分析.xlsx`,
  keepSheet: null,
  renameTo: '成本分析',
  out: 'cost-analysis-cnc.xlsx',
  deleteRows: Array.from({ length: 60 }, (_, index) => index + 6),
  cells: {
    A3: '客户名称：{{customer.name}}',
    M3: '产品型号：{{productModel}}',
    X3: '日期：{{preparedOn}}',
    Q4: '{{processLabel1}}',
    R4: '{{processLabel2}}',
    S4: '{{processLabel3}}',
    T4: '{{processLabel4}}',
    U4: '{{processLabel5}}',
    V4: '{{processLabel6}}',
    W4: '损耗（{{lossPercent}}）',
    X4: '管理费利润（{{overheadPercent}}）',
    Z4: '含税（{{vatPercent}}）',
    AA4: '金额含税（{{vatPercent}}）',
    A5: '{{*lines.#}}',
    B5: '{{*lines.blankType}}',
    C5: '{{*lines.drawingNo}}',
    E5: '{{*lines.spec}}',
    F5: '{{*lines.quantity}}',
    G5: '{{*lines.material}}',
    H5: '{{*lines.estimatedWeightKg}}',
    I5: '{{*lines.netWeightKg}}',
    J5: '{{*lines.scrapWeightKg}}',
    K5: '{{*lines.scrapUnitPrice}}',
    L5: '{{*lines.materialUnitPrice}}',
    M5: '{{*lines.materialAmount}}',
    N5: '{{*lines.machiningMethod}}',
    O5: '{{*lines.machiningMinutes}}',
    P5: '{{*lines.machiningAmount}}',
    Q5: '{{*lines.process1}}',
    R5: '{{*lines.process2}}',
    S5: '{{*lines.process3}}',
    T5: '{{*lines.process4}}',
    U5: '{{*lines.process5}}',
    V5: '{{*lines.process6}}',
    W5: '{{*lines.lossAmount}}',
    X5: '{{*lines.overheadAmount}}',
    Y5: '{{*lines.subtotal}}',
    Z5: '{{*lines.taxAmount}}',
    AA5: '{{*lines.totalWithTax}}',
    AB5: '{{*lines.remark}}',
    // 内部试算列（预计单价 / 调比）留空给使用者手填，公式清掉——复制行会把行号抄错
    AC5: null,
    AD5: null,
    AE5: null,
  },
}

/** `B11:G11` → 行列号。 */
function parseRange(range) {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range)
  if (!match) return null
  return {
    fromColumn: columnNumber(match[1]),
    fromRow: Number(match[2]),
    toColumn: columnNumber(match[3]),
    toRow: Number(match[4]),
  }
}

function columnNumber(letters) {
  return [...letters].reduce((value, letter) => value * 26 + (letter.charCodeAt(0) - 64), 0)
}

function columnLetters(column) {
  let letters = ''
  let remaining = column
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    remaining = Math.floor((remaining - 1) / 26)
  }
  return letters
}

/** 删掉 N 行之后，某一行原来的行号应该落到哪里。落在被删行上的返回 null。 */
function shiftRow(row, deleted) {
  if (deleted.includes(row)) return null
  return row - deleted.filter((deletedRow) => deletedRow < row).length
}

/** 按删行后的坐标重建全部合并区。先全部拆再全部合，避免与尚未拆掉的旧区间重叠。 */
function rebuildMerges(sheet, merges, deleted) {
  for (const range of [...sheet.model.merges]) {
    try {
      sheet.unMergeCells(range)
    } catch {
      /* 已经不在了 */
    }
  }

  for (const merge of merges) {
    const fromRow = shiftRow(merge.fromRow, deleted)
    const toRow = shiftRow(merge.toRow, deleted)
    if (fromRow === null || toRow === null || toRow < fromRow) continue
    const range = `${columnLetters(merge.fromColumn)}${fromRow}:${columnLetters(merge.toColumn)}${toRow}`
    try {
      sheet.mergeCells(range)
    } catch {
      /* 与相邻区间重叠：跳过这一个 */
    }
  }
}

async function author(spec) {
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(spec.source)

  const kept = spec.keepSheet ? book.getWorksheet(spec.keepSheet) : book.worksheets[0]
  if (!kept) throw new Error(`找不到工作表 ${spec.keepSheet} @ ${spec.source}`)
  for (const sheet of [...book.worksheets]) {
    if (sheet.id !== kept.id) book.removeWorksheet(sheet.id)
  }
  kept.name = spec.renameTo

  // ⚠️ 先把合并区抄下来。写值与删行都会让 ExcelJS 丢掉合并区（实测国内报价单
  // 从 51 个掉到 33 个，第 13 行以下全没了），因此改成「抄下来 → 改 → 按预期重建」，
  // 不指望它自己活下来。丢了合并区的后果在样张上一眼可见：
  // 「币别」变成「币别 币别」，条款行糊成一格一个字。
  const merges = kept.model.merges.map(parseRange).filter(Boolean)

  for (const [address, value] of Object.entries(spec.cells)) {
    kept.getCell(address).value = value
  }
  // 倒序删，否则删掉上面一行下面的行号就全错位了
  const deleted = [...spec.deleteRows].sort((a, b) => b - a)
  for (const rowNumber of deleted) {
    kept.spliceRows(rowNumber, 1)
  }

  rebuildMerges(kept, merges, deleted)

  mkdirSync(outDir, { recursive: true })
  await book.xlsx.writeFile(resolve(outDir, spec.out))
  console.log(
    `✓ ${spec.out}  sheet="${kept.name}" rows=${kept.rowCount} ` +
      `merges=${kept.model.merges.length} images=${kept.getImages().length}`,
  )
}

for (const spec of [DOMESTIC, OVERSEAS, COST]) {
  await author(spec)
}
