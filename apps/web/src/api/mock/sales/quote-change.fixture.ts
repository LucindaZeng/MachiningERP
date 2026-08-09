import type { QuoteChangeRequest } from '@/types/sales.types'

/**
 * 报价单修改申请（QRC）：业务直接提交修改后的价格，
 * 报价工程师改成本分析后接受，或驳回并填写驳回理由。
 */
export const QUOTE_CHANGES: QuoteChangeRequest[] = [
  {
    id: 'QRC1',
    docNo: 'QRC-20260728-0004',
    quotationNo: 'QT-20260718-0026',
    customerName: 'Radex Instruments Inc.',
    productName: '探头支架',
    drawingNo: 'RX-3390',
    beforeTiers: [
      { quantity: '300', unitPrice: '27.40' },
      { quantity: '1500', unitPrice: '24.90' },
    ],
    afterTiers: [
      { quantity: '300', unitPrice: '26.20' },
      { quantity: '1500', unitPrice: '23.60' },
    ],
    currency: 'USD',
    reason: '客户拿到同行报价 24.10 USD/件（1500 档），要求降至 23.60 才下单，年度用量预计 8000 件',
    evidence: '客户目标价函件 RX-TP-2607.pdf',
    applicant: '陈志强',
    submittedAt: '2026-07-28 09:20',
    engineer: '吴工',
    status: 'reviewing',
    timeline: [
      { node: 'QRC-01 业务提交改价申请', owner: '陈志强', state: 'done', elapsedHours: 0.4 },
      {
        node: 'QRC-02 报价工程师复核成本分析',
        owner: '报价工程师 · 吴工',
        state: 'active',
        enteredAt: '2026-07-28 10:00',
        dueAt: '2026-07-29 10:00',
        remark: '正在复核硬质阳极委外单价与四轴工时，判断 23.60 是否仍达毛利底线',
      },
      { node: 'QRC-03 结果回写报价单', owner: '系统', state: 'pending' },
    ],
  },
  {
    id: 'QRC2',
    docNo: 'QRC-20260726-0003',
    quotationNo: 'QT-20260722-0031',
    customerName: '香港宏晟精密（代生产）',
    productName: '连接器外壳 CNC 件',
    drawingNo: 'HS-4471-A',
    beforeTiers: [
      { quantity: '1000', unitPrice: '17.60' },
      { quantity: '5000', unitPrice: '16.80' },
    ],
    afterTiers: [
      { quantity: '1000', unitPrice: '17.00' },
      { quantity: '5000', unitPrice: '16.20' },
    ],
    currency: 'CNY',
    reason: '客户追加年度框架量至 5 万件，要求在原阶梯基础上再让 3.6%',
    evidence: '客户年度框架意向函 HS-FA-2026.pdf',
    applicant: '罗晓琳',
    submittedAt: '2026-07-26 14:10',
    engineer: '吴工',
    handledAt: '2026-07-27 09:40',
    result: 'accepted',
    newCostAnalysisNo: 'CA-20260727-0031-R2',
    newMarginRate: 0.186,
    status: 'completed',
    timeline: [
      { node: 'QRC-01 业务提交改价申请', owner: '罗晓琳', state: 'done', elapsedHours: 0.3 },
      {
        node: 'QRC-02 报价工程师复核成本分析',
        owner: '报价工程师 · 吴工',
        state: 'done',
        elapsedHours: 19.5,
        remark: '按 5 万件重算刀具与工装分摊，单件成本由 13.05 降至 13.18 以下，接受改价',
      },
      {
        node: 'QRC-03 结果回写报价单',
        owner: '系统',
        state: 'done',
        elapsedHours: 0.1,
        remark: '生成 CA-20260727-0031-R2，报价单升版 V3，毛利率 18.6% 仍达标',
      },
    ],
  },
  {
    id: 'QRC3',
    docNo: 'QRC-20260724-0002',
    quotationNo: 'QT-20260727-0042',
    customerName: '苏州明泰自动化',
    productName: '直线导轨安装座',
    drawingNo: 'MT-7719',
    beforeTiers: [{ quantity: '500', unitPrice: '46.20' }],
    afterTiers: [{ quantity: '500', unitPrice: '41.00' }],
    currency: 'CNY',
    reason: '客户口头压价至 41.00，业务希望先接单再想办法',
    applicant: '罗晓琳',
    submittedAt: '2026-07-24 16:30',
    engineer: '吴工',
    handledAt: '2026-07-25 11:05',
    result: 'rejected',
    rejectReason:
      '41.00 对应单件毛利仅 1.8%，低于 18% 阈值且低于变动成本加成底线；平面度 0.02 需二次光刀的工时无法压缩，委外发黑已是框架协议价。建议改为：维持 46.20，或把平面度放宽到 0.05 后重新出图再报价。',
    status: 'rejected',
    timeline: [
      { node: 'QRC-01 业务提交改价申请', owner: '罗晓琳', state: 'done', elapsedHours: 0.2 },
      {
        node: 'QRC-02 报价工程师复核成本分析',
        owner: '报价工程师 · 吴工',
        state: 'done',
        elapsedHours: 18.6,
        remark: '复核后驳回，理由已回填并同步业务经理',
      },
      { node: 'QRC-03 结果回写报价单', owner: '系统', state: 'done', remark: '原报价单维持 V1，不升版' },
    ],
  },
]
