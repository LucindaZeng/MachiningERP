/**
 * 统一的 Excel 导出工具（SheetJS）。
 * 约定：所有列表与单据导出都走这里，保证列头口径、数字格式与文件命名一致。
 * 金额/数量在系统内是定点数字符串，导出时保持字符串形态，避免 Excel 自动转科学计数或丢精度。
 */
import * as XLSX from 'xlsx'

export interface ExportColumn<T> {
  /** 列头文字 */
  label: string
  /** 取值：字段名或取值函数 */
  value: keyof T | ((row: T) => string | number | undefined | null)
  /** 列宽（字符数），不传按列头长度推算 */
  width?: number
}

export interface SheetSpec<T> {
  name: string
  columns: Array<ExportColumn<T>>
  rows: T[]
  /** 表格上方的说明行（口径、导出时间、筛选条件等） */
  notes?: string[]
}

function cell<T>(row: T, column: ExportColumn<T>): string | number {
  const raw =
    typeof column.value === 'function' ? column.value(row) : (row[column.value] as unknown)
  if (raw === undefined || raw === null) {
    return ''
  }
  return typeof raw === 'number' ? raw : String(raw)
}

function buildSheet<T>(spec: SheetSpec<T>): XLSX.WorkSheet {
  const head = spec.columns.map((column) => column.label)
  const body = spec.rows.map((row) => spec.columns.map((column) => cell(row, column)))
  const notes = (spec.notes ?? []).map((text) => [text])
  const sheet = XLSX.utils.aoa_to_sheet([...notes, ...(notes.length ? [[]] : []), head, ...body])

  sheet['!cols'] = spec.columns.map((column) => ({
    wch: column.width ?? Math.max(10, column.label.length * 2 + 2),
  }))

  return sheet
}

/**
 * 触发下载。
 * 不用 XLSX.writeFile：它在部分浏览器里拿不到我们指定的文件名（会存成无扩展名的 download），
 * 这里统一走 Blob + a[download]，保证中文文件名与 .xlsx 扩展名都正确。
 */
function saveWorkbook(book: XLSX.WorkBook, fileName: string): void {
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // 交给浏览器写盘后再释放，过早 revoke 会导致下载中断
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 单表导出 */
export function exportSheet<T>(spec: SheetSpec<T>, fileName: string): void {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, buildSheet(spec), safeSheetName(spec.name))
  saveWorkbook(book, withStamp(fileName))
}

/** 多表导出：一个工作簿多个工作表 */
export function exportWorkbook(specs: Array<SheetSpec<never>>, fileName: string): void {
  const book = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const spec of specs) {
    let name = safeSheetName(spec.name)
    let index = 2
    while (used.has(name)) {
      name = safeSheetName(`${spec.name}-${index++}`)
    }
    used.add(name)
    XLSX.utils.book_append_sheet(book, buildSheet(spec), name)
  }
  saveWorkbook(book, withStamp(fileName))
}

/** Excel 工作表名不能超过 31 字符，且不允许 : \ / ? * [ ] */
function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Sheet1'
}

/** 文件名带导出时间戳，便于归档与追溯 */
function withStamp(fileName: string): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${fileName}-${stamp}.xlsx`
}

/** 导出说明行：统一写明数据口径与导出时间 */
export function exportNotes(title: string, extra: string[] = []): string[] {
  return [
    `${title}　导出时间：${new Date().toLocaleString('zh-CN')}`,
    ...extra,
    '数据口径见系统内各报表卡片说明；金额与数量为定点数，导出后请勿改为浮点格式。',
  ]
}
