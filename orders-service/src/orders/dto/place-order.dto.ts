import { IsArray, IsEnum, IsISO8601, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum MenuCategory {
  SOUP = 'SOUP',
  MAIN = 'MAIN',
  DESSERT = 'DESSERT',
  RESERVE = 'RESERVE',
}

export class SelectionDto {
  @IsEnum(MenuCategory)
  category: MenuCategory;

  @IsString()
  @Length(36, 36)
  optionId: string;
}

export class PlaceOrderDto {
  @IsString()
  @Length(36, 36)
  childId: string;

  @IsISO8601({ strict: true })
  orderDate: string;

  @IsString()
  @Length(36, 36)
  dailyMenuId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionDto)
  selections: SelectionDto[];
}
