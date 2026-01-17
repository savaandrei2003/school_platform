import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { EmailService } from './email.service';
import { OrdersEventsConsumer } from './orders-events.consumer';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URI!,
      exchanges: [
        {
          name: process.env.RABBITMQ_EXCHANGE || 'school.events',
          type: 'topic',
        },
      ],
      connectionInitOptions: { wait: true, timeout: 30000 },
    }),
  ],
  controllers: [AppController],
  providers: [EmailService, OrdersEventsConsumer],
})
export class AppModule {}
