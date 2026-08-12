import { IsOptional, IsString } from 'class-validator'

export class ListEcnDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsString() orderId?: string
  @IsOptional() @IsString() status?: string
  @IsOptional() @IsString() changeType?: string
  @IsOptional() @IsString() ownerUserCode?: string
}
