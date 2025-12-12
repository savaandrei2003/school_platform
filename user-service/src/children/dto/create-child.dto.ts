import { IsEmail, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateChildDto {
  @IsString()
  name: string;

  @IsString()
  class: string;

  @IsEmail()
  parentEmail: string;

  @IsOptional()
  @IsArray()
  allergies?: string[];
}
