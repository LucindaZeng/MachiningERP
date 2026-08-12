import type { NumberResetPolicy, PrismaClient } from '@prisma/client'

interface RuleSeed {
  docType: string
  prefix: string
  datePattern: string
  padding: number
  separator: string
  resetPolicy: NumberResetPolicy
  description: string
}

/**
 * 单据编号规则。业务模块一律通过 DocNumberService 取号，禁止各自拼编号。
 * USER_CODE 单列：`WFX-2026-0209` 形式，配合 issued_user_codes 台账保证永不复用。
 */
export const DOC_NUMBER_RULES: RuleSeed[] = [
  { docType: 'USER_CODE', prefix: 'WFX', datePattern: 'yyyy', padding: 4, separator: '-', resetPolicy: 'YEARLY', description: '用户唯一编码，终身不变、永不复用' },
  { docType: 'ACR', prefix: 'ACR', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '账户申请' },
  { docType: 'PWR', prefix: 'PWR', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '密码重置申请' },
  { docType: 'CUS', prefix: 'C', datePattern: '', padding: 4, separator: '', resetPolicy: 'NONE', description: '客户编号，系统生成不可手改' },
  { docType: 'CCR', prefix: 'CCR', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '客户敏感字段变更申请' },
  { docType: 'INQ', prefix: 'INQ', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '询价单' },
  { docType: 'QTN', prefix: 'QTN', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '报价单' },
  { docType: 'CST', prefix: 'CST', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '成本分析表' },
  { docType: 'QCR', prefix: 'QCR', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '报价单修改申请' },
  { docType: 'SO', prefix: 'SO', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '正常业务订单' },
  { docType: 'SMP', prefix: 'SMP', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '样品订单' },
  { docType: 'MLD', prefix: 'MLD', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '模具订单' },
  { docType: 'STK', prefix: 'STK', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '备料订单（总经办必批）' },
  { docType: 'OCR', prefix: 'OCR', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '订单修改申请（只改数量/交期）' },
  { docType: 'BOMR', prefix: 'BOMR', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: 'BOM 申请' },
  { docType: 'ECN', prefix: 'ECN', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: 'ECN 申请（改图/改材料/改表处）' },
  { docType: 'SHP', prefix: 'SHP', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '出货单' },
  { docType: 'RMA', prefix: 'RMA', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '退货单' },
  { docType: 'INV', prefix: 'INV', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '发票申请' },
  { docType: 'EXP', prefix: 'EXP', datePattern: 'yyyyMMdd', padding: 4, separator: '', resetPolicy: 'DAILY', description: '报关资料' },
  { docType: 'STM', prefix: 'STM', datePattern: 'yyyyMM', padding: 4, separator: '', resetPolicy: 'MONTHLY', description: '客户对账单' },
]

export async function seedDocNumberRules(prisma: PrismaClient): Promise<void> {
  for (const rule of DOC_NUMBER_RULES) {
    await prisma.docNumberRule.upsert({
      where: { docType: rule.docType },
      create: { ...rule },
      update: { ...rule },
    })
  }
}
