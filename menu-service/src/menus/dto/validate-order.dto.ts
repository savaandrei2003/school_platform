import { IsArray, IsEnum, IsISO8601, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MenuCategory } from './create-daily-menu.dto';

export class ValidateSelectionDto {
  @IsEnum(MenuCategory)
  category: MenuCategory;

  @IsString()
  optionId: string;
}

export class ValidateOrderDto {
  @IsString()
  dailyMenuId: string;

  @IsISO8601()
  orderDate: string; // "2026-01-04"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateSelectionDto)
  selections: ValidateSelectionDto[];
}
