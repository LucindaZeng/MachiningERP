import { IsInt } from 'class-validator'

/** 只推进节点的动作（提交、送财务、寄出、签收）：只需要乐观锁版本。 */
export class InvoiceActionDto {
  @IsInt() versionLock!: number
}
