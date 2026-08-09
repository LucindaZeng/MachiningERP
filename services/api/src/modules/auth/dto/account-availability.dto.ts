import { IsString, MaxLength } from 'class-validator'

export class AccountAvailabilityDto {
  @IsString()
  @MaxLength(32)
  account!: string
}
