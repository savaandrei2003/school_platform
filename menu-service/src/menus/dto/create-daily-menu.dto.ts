import { IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum MenuCategory {
  SOUP = 'SOUP',
  MAIN = 'MAIN',
  DESSERT = 'DESSERT',
  RESERVE = 'RESERVE',
}

export class CreateMenuOptionDto {
  @IsEnum(MenuCategory)
  category: MenuCategory;

  @IsString()
  name: string;

  @IsOptional()
  allergens?: any;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateDailyMenuDto {
  @IsISO8601()
  date: string; // "2026-01-04"

  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMenuOptionDto)
  options: CreateMenuOptionDto[];
}
