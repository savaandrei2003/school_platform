import { IsISO8601, IsString, Length } from 'class-validator';

export class PlaceMonthDefaultsDto {
  @IsString()
  @Length(36, 36)
  childId: string;

  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;
}
