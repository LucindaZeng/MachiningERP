import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

const TAIL_PLANS = ['rework', 'stock', 'direct-stock', 'scrap'] as const

/**
 * 尾数四路径处理。按单据号定位（前端就是这么调的），
 * 方案一次应用到该单所有还有尾数的行——结案的平衡校验是按行做的。
 */
export class TailPlanDto {
  @IsString() docNo!: string
  @IsIn(TAIL_PLANS) plan!: (typeof TAIL_PLANS)[number]
  @IsOptional() @IsString() @MaxLength(500) remark?: string | null
}
