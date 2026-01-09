import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MenusClient } from '../clients/menus.client';
import { UsersClient } from '../clients/users.client';
import { ServiceTokenProvider } from 'src/auth/service-token.provider';
import { OrdersScheduler } from './orders.scheduler';
import { OrdersEventsPublisher } from 'src/events/orders-events.publisher';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, MenusClient, UsersClient, ServiceTokenProvider, OrdersScheduler, OrdersEventsPublisher],
})
export class OrdersModule {}
