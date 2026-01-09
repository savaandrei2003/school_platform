import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { EmailService, OrderConfirmedEvent } from './email.service';

@Injectable()
export class OrdersEventsConsumer {
  private readonly logger = new Logger(OrdersEventsConsumer.name);

  constructor(private readonly email: EmailService) {}

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE || 'school.events',
    routingKey: 'order.confirmed',
    queue: 'notifications.email',
    queueOptions: { durable: true },
  })
  async handleOrderConfirmed(msg: OrderConfirmedEvent) {
    // minimal validation
    if (!msg?.data?.parent?.email) {
      this.logger.warn('Missing parent email; skipping message');
      return;
    }

    await this.email.sendOrderConfirmed(msg);
    this.logger.log(`Sent email to ${msg.data.parent.email} for order ${msg.data.orderId}`);
  }
}
