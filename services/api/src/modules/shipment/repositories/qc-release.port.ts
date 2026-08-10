/**
 * 品质放行读端口（业务规格第 7 章「品质放行结论……通过后方可过账」）。
 *
 * QMS 模块尚未落地，所以这里只声明**读**契约，由 shipment 模块自己提供一个
 * 明确标注的 stub provider（见 stub-qc-release.adapter.ts）。QMS 上线时把
 * provider 换成真实实现即可，本模块的判定逻辑一行都不用动。
 */
export interface QcReleaseVerdict {
  /** 是否已放行；未做检验也算未放行，绝不默认放行 */
  released: boolean
  /** 未放行的原因，直接展示给业务员 */
  reason: string | null
  /** 检验记录号，供出货单留痕 */
  inspectionNo: string | null
}

export interface QcReleaseQuery {
  drawingNo: string
  batchNo: string
}

export interface QcReleasePort {
  /** 按图号 + 批次查放行结论；查不到时必须返回 released:false，不得抛错放行。 */
  verdictFor(query: QcReleaseQuery): Promise<QcReleaseVerdict>
}

export const QC_RELEASE_PORT = Symbol('QC_RELEASE_PORT')
