import { IsISO8601, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class PlaceOrderDto {
  @IsString()
  @Length(36, 36)
  childId: string;

  // ziua comenzii: "2026-01-04"
  @IsISO8601({ strict: true })
  orderDate: string;

  // ce a ales părintele (json)
  @IsObject()
  choices: Record<string, any>;

  // dacă vrei să forțezi menuDate separat (de obicei = orderDate)
  @IsOptional()
  @IsISO8601({ strict: true })
  menuDate?: string;
}
