import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
  constructor(private readonly orders: OrdersService) {}

  @Cron('1 9 * * *', { timeZone: 'Europe/Bucharest' })
  async run() {
    // refolosește fallback-ul existent
    await (this.orders as any).confirmTodayIfAfterCutoff();
  }
}
