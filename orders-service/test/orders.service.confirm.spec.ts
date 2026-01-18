import { Test } from '@nestjs/testing';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MenusClient } from '../src/clients/menus.client';
import { UsersClient } from '../src/clients/users.client';
import { OrdersEventsPublisher } from '../src/events/orders-events.publisher';

describe('OrdersService - confirmTodayIfAfterCutoff', () => {
  let svc: OrdersService;

  const prismaMock = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    order: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const menusClientMock = {};
  const usersClientMock = {};
  const publisherMock = {
    publishOrderConfirmed: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.ORDER_CONFIRMATION = '00:00:00';

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MenusClient, useValue: menusClientMock },
        { provide: UsersClient, useValue: usersClientMock },
        { provide: OrdersEventsPublisher, useValue: publisherMock },
      ],
    }).compile();

    svc = moduleRef.get(OrdersService);
  });

  it('does nothing when there are no pending orders', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await svc.confirmTodayIfAfterCutoff();

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(publisherMock.publishOrderConfirmed).not.toHaveBeenCalled();
  });

  it('updates pending orders and publishes one event per order', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: 'o1',
        childId: 'c1',
        parentSub: 'p1',
        parentEmail: 'p1@test.com',
        orderDate: '2026-01-18T00:00:00.000Z',
        snapshot: [
          { category: 'SOUP', optionName: 'Ciorbă' },
          { category: 'MAIN', optionName: 'Paste' },
          { category: 'DESSERT', optionName: 'Măr' },
        ],
      },
      {
        id: 'o2',
        childId: 'c2',
        parentSub: 'p2',
        parentEmail: 'p2@test.com',
        orderDate: '2026-01-18T00:00:00.000Z',
        snapshot: [{ category: 'MAIN', optionName: 'Orez' }],
      },
    ]);

    prismaMock.$executeRaw.mockResolvedValueOnce(undefined);
    publisherMock.publishOrderConfirmed.mockResolvedValue(undefined);

    await svc.confirmTodayIfAfterCutoff();

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(publisherMock.publishOrderConfirmed).toHaveBeenCalledTimes(2);

    const call1 = publisherMock.publishOrderConfirmed.mock.calls[0][0];
    expect(call1.orderId).toBe('o1');
    expect(call1.parent.email).toBe('p1@test.com');
    expect(call1.menu.main).toBe('Paste');

    const call2 = publisherMock.publishOrderConfirmed.mock.calls[1][0];
    expect(call2.orderId).toBe('o2');
    expect(call2.parent.email).toBe('p2@test.com');
  });
});
