import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator'

export class DeliveryAddressDto {
  @IsString() @MaxLength(64) label!: string
  @IsString() @MinLength(1) @MaxLength(64) receiver!: string
  @IsString() @MaxLength(64) phone!: string
  @IsString() @MinLength(1) @MaxLength(255) address!: string
  @IsBoolean() isDefault!: boolean
}
