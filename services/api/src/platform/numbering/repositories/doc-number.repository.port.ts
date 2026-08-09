import type { NumberResetPolicy } from '@prisma/client'

export interface DocNumberRuleRecord {
  docType: string
  prefix: string
  datePattern: string
  padding: number
  separator: string
  resetPolicy: NumberResetPolicy
}

/**
 * 编号仓储端口。service 只依赖本接口，Prisma 实现放在同目录的适配器里，
 * 单元测试用内存假实现，无需数据库。
 */
export interface DocNumberRepositoryPort {
  findRule(docType: string): Promise<DocNumberRuleRecord | null>
  /** 原子自增并返回该周期内的新序号 */
  nextSequence(docType: string, periodKey: string): Promise<number>
}

export const DOC_NUMBER_REPOSITORY = Symbol('DOC_NUMBER_REPOSITORY')
