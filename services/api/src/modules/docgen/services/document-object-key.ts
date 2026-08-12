import { randomUUID } from 'node:crypto'

/**
 * 生成物在对象存储上的位置。
 *
 * 与图纸那支 `composeDrawingObjectKey` 分开写，是因为两类文件的定位方式不同：
 * 图纸靠「图号 + 版本」定位、要查重；生成物天生挂在自己那张单据上，
 * 不需要查重，但**每次出具都必须是新键**——`putImmutable` 会拒绝覆盖，
 * 而 kkFileView 按 URL 缓存转换结果，键重用就会把旧版渲染结果端给用户。
 */

/** 键里只留字母数字、点、连字符与中文；其余压成连字符。与图纸那支保持同一口径。 */
export function sanitizeSegment(value: string): string {
  const cleaned = value.replace(/[^\w.\-一-龥]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned : 'unnamed'
}

/**
 * 报关文件：`customs/{报关资料号}/{文件种类}-v{版本}.xlsx`。
 *
 * 版本进键是刻意的——报关文件的历史版本要能原样调阅，
 * 而键相同意味着 putImmutable 会拒绝第二版落盘。
 */
export function composeCustomsObjectKey(docNo: string, kind: string, version: number): string {
  return `customs/${sanitizeSegment(docNo)}/${sanitizeSegment(kind)}-v${version}.xlsx`
}

/**
 * 其它单据的生成物：`documents/{来源类型}/{来源单号}/{模板}-v{模板版本}-{uuid}.xlsx`。
 *
 * 结尾带 uuid 而不是时间戳：同一秒内连点两次「导出」在真实使用中并不罕见，
 * 时间戳撞了就会被 putImmutable 挡下来，用户看到的是一个莫名其妙的报错。
 */
export function composeGeneratedObjectKey(input: {
  sourceType: string
  sourceDocNo: string
  templateId: string
  templateVersion: number
}): string {
  const folder = `${sanitizeSegment(input.sourceType)}/${sanitizeSegment(input.sourceDocNo)}`
  const name = `${sanitizeSegment(input.templateId)}-v${input.templateVersion}-${randomUUID()}`
  return `documents/${folder}/${name}.xlsx`
}

/** 客户看到的文件名。带单号与日期，落到本地下载目录里也能认出是哪一份。 */
export function composeFileName(label: string, docNo: string, issuedOn: Date): string {
  const stamp = `${issuedOn.getFullYear()}${pad(issuedOn.getMonth() + 1)}${pad(issuedOn.getDate())}`
  return `${sanitizeSegment(label)}-${sanitizeSegment(docNo)}-${stamp}.xlsx`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** xlsx 的 MIME。落存储时要写对，kkFileView 靠它与扩展名一起挑渲染器。 */
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
