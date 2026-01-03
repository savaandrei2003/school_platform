import { IsISO8601, IsString, Length } from 'class-validator';

export class PlaceMonthDefaultsDto {
  @IsString()
  @Length(36, 36)
  childId: string;

  // ex: "2026-01-01"
  @IsISO8601({ strict: true })
  from: string;

  // ex: "2026-01-31"
  @IsISO8601({ strict: true })
  to: string;
}
