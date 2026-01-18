import { Test } from '@nestjs/testing';
import { OrdersEventsConsumer } from '../src/orders-events.consumer';
import { EmailService } from '../src/email.service';

describe('OrdersEventsConsumer', () => {
  let consumer: OrdersEventsConsumer;

  const emailMock = {
    sendOrderConfirmed: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersEventsConsumer,
        { provide: EmailService, useValue: emailMock },
      ],
    }).compile();

    consumer = moduleRef.get(OrdersEventsConsumer);
  });

  it('skips message when parent email is missing', async () => {
    const msg: any = {
      eventId: 'e1',
      occurredAt: new Date().toISOString(),
      type: 'order.confirmed',
      data: {
        orderId: 'o1',
        orderDate: '2026-01-18',
        parent: { sub: 's1', email: '' },
        child: { id: 'c1', name: 'Ion', class: '3A' },
      },
    };

    await consumer.handleOrderConfirmed(msg);

    expect(emailMock.sendOrderConfirmed).not.toHaveBeenCalled();
  });

  it('sends email when parent email exists', async () => {
    const msg: any = {
      eventId: 'e2',
      occurredAt: new Date().toISOString(),
      type: 'order.confirmed',
      data: {
        orderId: 'o2',
        orderDate: '2026-01-18',
        parent: { sub: 's2', email: 'p@test.com' },
        child: { id: 'c2', name: 'Maria', class: '2B' },
        menu: { soup: 'Ciorbă', main: 'Paste', dessert: 'Măr' },
      },
    };

    await consumer.handleOrderConfirmed(msg);

    expect(emailMock.sendOrderConfirmed).toHaveBeenCalledTimes(1);
    expect(emailMock.sendOrderConfirmed).toHaveBeenCalledWith(msg);
  });
});
