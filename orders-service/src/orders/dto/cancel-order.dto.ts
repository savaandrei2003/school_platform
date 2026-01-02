import { IsString, Length } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @Length(36, 36)
  orderId: string;
}
