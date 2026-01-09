import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'crypto';

@Injectable()
export class OrdersEventsPublisher {
  constructor(private readonly amqp: AmqpConnection) {}

  async publishOrderConfirmed(data: any) {
    await this.amqp.publish('school.events', 'order.confirmed', {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      type: 'order.confirmed',
      data,
    }, { persistent: true });
  }
}
