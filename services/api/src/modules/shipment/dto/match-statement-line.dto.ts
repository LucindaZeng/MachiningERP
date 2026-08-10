import { IsBoolean } from 'class-validator'

/** 客户核对状态是对账单上唯一允许人工改的字段。 */
export class MatchStatementLineDto {
  @IsBoolean() matched!: boolean
}
