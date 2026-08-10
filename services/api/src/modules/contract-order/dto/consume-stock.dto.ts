import { IsNumberString, IsString } from 'class-validator'

/**
 * 正式订单领用备料。
 *
 * 领用数量**不由前端指定**——按「优先消耗备料直到用完」的规则由后端算，
 * 前端只说要领哪张备料单、本单数量多少。
 */
export class ConsumeStockDto {
  @IsString() orderLineId!: string
  @IsString() stockOrderId!: string
  @IsNumberString() orderQty!: string
  @IsNumberString() produceUnitCostMinor!: string
}
