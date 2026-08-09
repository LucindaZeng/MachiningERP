import { IsInt, Max, Min } from 'class-validator'

/**
 * 调整成本分析的费率（仅报价工程师）。
 *
 * 全部按**万分比整数**传：5% = 500、7% = 700、10% = 1000、13% = 1300。
 * 默认值 5%/5%/13% 只是初值，按产品与客户情况自行调整是常规操作。
 */
export class UpdateCostRatesDto {
  @IsInt() versionLock!: number

  /** 损耗率，如 700 表示 7% */
  @IsInt() @Min(0) @Max(10_000) lossBps!: number
  /** 管理费利润率，如 1000 表示 10% */
  @IsInt() @Min(0) @Max(10_000) overheadBps!: number
  /** 增值税率，如 1300 表示 13% */
  @IsInt() @Min(0) @Max(10_000) vatBps!: number
}
