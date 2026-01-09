import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URI!,
      exchanges: [
        { name: process.env.RABBITMQ_EXCHANGE || 'school.events', type: 'topic' },
      ],
      connectionInitOptions: { wait: true },
    }),
  ],
  exports: [RabbitMQModule],
})
export class MessagingModule {}
