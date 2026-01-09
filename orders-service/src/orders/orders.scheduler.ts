import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);

  constructor(private readonly orders: OrdersService) {}

  @Cron('0 9 * * *', { timeZone: 'Europe/Bucharest' })
  async run() {
    await this.orders.confirmTodayIfAfterCutoff();
  }
}
