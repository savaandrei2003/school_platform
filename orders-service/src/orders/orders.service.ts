import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MenusClient } from '../clients/menus.client';
import { UsersClient } from '../clients/users.client';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { isOrderLockedForDate, parseISODateOnly } from '../common/time';
import { PlaceMonthDefaultsDto } from './dto/place-month-defaults.dto';
import { OrdersEventsPublisher } from 'src/events/orders-events.publisher';

type MenuValidationResponse = {
  ok: boolean;
  menuId: string;
  date: string; // YYYY-MM-DD
  normalizedSelections?: Array<{
    category: string;
    optionId: string;
    optionName: string;
  }>;
};

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menusClient: MenusClient,
    private readonly usersClient: UsersClient,
    private readonly publisher: OrdersEventsPublisher,
  ) {}


  async onModuleInit() {
    await this.confirmTodayIfAfterCutoff();
  }

  private extractBearer(req: any): string {
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return '';
    return auth.substring('Bearer '.length);
  }


  public async confirmTodayIfAfterCutoff() {
    const cutoff = process.env.ORDER_CONFIRMATION ?? '09:00:00';

    const pending = await this.prisma.$queryRaw<any[]>`
    SELECT o.id, o.childId, o.parentSub, o.parentEmail, o.orderDate, os.snapshot
    FROM \`Order\` o
    LEFT JOIN OrderSelection os ON os.orderId = o.id
    WHERE o.status = 'PENDING'
      AND DATE(o.orderDate) = CURDATE()
      AND CURRENT_TIME() > ${cutoff}
  `;

    if (pending.length === 0) return;

    await this.prisma.$executeRaw`
    UPDATE \`Order\`
    SET status = 'CONFIRMED'
    WHERE status = 'PENDING'
      AND DATE(orderDate) = CURDATE()
      AND CURRENT_TIME() > ${cutoff}
  `;

    for (const o of pending) {
      const snap = (o.snapshot as any[]) || [];
      const pick = (cat: string) =>
        snap.find((x: any) => x.category === cat)?.optionName || '';

      await this.publisher.publishOrderConfirmed({
        orderId: o.id,
        orderDate: String(o.orderDate).slice(0, 10),
        child: { id: o.childId, name: '', class: '' },
        parent: { sub: o.parentSub, email: o.parentEmail },
        menu: {
          soup: pick('SOUP'),
          main: pick('MAIN'),
          dessert: pick('DESSERT'),
          reserve: pick('RESERVE'),
        },
      });
    }
  }

  async placeOrder(req: any, dto: PlaceOrderDto) {
    const user = req.user as { sub: string; email?: string; roles?: string[] };
    if (!user?.sub) throw new ForbiddenException('Missing user context');

    const parentSub = user.sub;
    const parentEmail = user.email ?? '';

    const orderDate = parseISODateOnly(dto.orderDate);
    const menuDate = orderDate;

    if (isOrderLockedForDate(orderDate)) {
      throw new BadRequestException(
        'Orders are locked for this date (past date or today after 09:00).',
      );
    }

    const userToken = this.extractBearer(req);
    if (!userToken) throw new ForbiddenException('Missing bearer token');

    await this.usersClient.assertChildBelongsToParent(dto.childId, userToken);

    const validation = (await this.menusClient.validateOrder({
      dailyMenuId: dto.dailyMenuId,
      orderDate: dto.orderDate,
      selections: dto.selections,
    })) as MenuValidationResponse;

    if (!validation?.ok) {
      throw new BadRequestException('Menu validation failed');
    }

    const existing = await this.prisma.order.findUnique({
      where: {
        childId_orderDate: {
          childId: dto.childId,
          orderDate,
        },
      },
      include: { selection: true },
    });

    if (existing && existing.parentSub !== parentSub) {
      throw new ForbiddenException('Cannot modify order not owned by you');
    }

    const choicesJson = dto.selections as unknown as Prisma.InputJsonValue;

    const snapshotJson = (validation.normalizedSelections ??
      null) as unknown as Prisma.InputJsonValue;

    return this.prisma.order.upsert({
      where: {
        childId_orderDate: {
          childId: dto.childId,
          orderDate,
        },
      },
      create: {
        parentSub,
        parentEmail,
        childId: dto.childId,
        orderDate,
        menuDate,
        menuId: validation.menuId,
        status: OrderStatus.PENDING,
        selection: {
          create: {
            choices: choicesJson,
            snapshot: snapshotJson,
          },
        },
      },
      update: {
        parentEmail,
        menuDate,
        menuId: validation.menuId,
        status: OrderStatus.PENDING,
        selection: existing?.selection
          ? {
              update: {
                choices: choicesJson,
                snapshot: snapshotJson,
              },
            }
          : {
              create: {
                choices: choicesJson,
                snapshot: snapshotJson,
              },
            },
      },
      include: { selection: true },
    });
  }

  async cancelOrder(req: any, orderId: string) {
    const user = req.user as { sub: string };
    if (!user?.sub) throw new ForbiddenException('Missing user context');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.parentSub !== user.sub) {
      throw new ForbiddenException('Cannot cancel order not owned by you');
    }

    if (isOrderLockedForDate(order.orderDate)) {
      throw new BadRequestException(
        'Orders are locked for this date (past date or today after 09:00).',
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: new Date(),
      },
    });
  }

  async listForParent(parentSub: string, q: ListOrdersQueryDto) {
    await this.confirmTodayIfAfterCutoff();

    const where: any = { parentSub };

    if (q.from || q.to) {
      where.orderDate = {};
      if (q.from) where.orderDate.gte = new Date(q.from);
      if (q.to) where.orderDate.lte = new Date(q.to);
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { orderDate: 'asc' },
      include: { selection: true },
    });
  }

  async listToday(parentSub: string) {
    await this.confirmTodayIfAfterCutoff();

    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return this.prisma.order.findMany({
      where: {
        parentSub,
        orderDate: { gte: start, lte: end },
      },
      include: { selection: true },
    });
  }

  async placeMonthlyDefaults(req: any, dto: PlaceMonthDefaultsDto) {
    const user = req.user as { sub: string; email?: string; roles?: string[] };
    if (!user?.sub) throw new ForbiddenException('Missing user context');

    const parentSub = user.sub;
    const parentEmail = user.email ?? '';

    const userToken = this.extractBearer(req);
    if (!userToken) throw new ForbiddenException('Missing bearer token');

    await this.usersClient.assertChildBelongsToParent(dto.childId, userToken);

    const menus = await this.menusClient.getDailyMenusRange(dto.from, dto.to);

    const fromDate = parseISODateOnly(dto.from.slice(0, 10));
    const toDate = parseISODateOnly(dto.to.slice(0, 10));
    const existing = await this.prisma.order.findMany({
      where: {
        childId: dto.childId,
        orderDate: { gte: fromDate, lte: toDate },
      },
      select: { parentSub: true },
    });

    if (existing.some((o) => o.parentSub !== parentSub)) {
      throw new ForbiddenException(
        'Some orders in this interval are not owned by you.',
      );
    }

    const ops: Prisma.PrismaPromise<any>[] = [];

    for (const m of menus) {
      const dateISO = new Date(m.date).toISOString().slice(0, 10);
      const orderDate = parseISODateOnly(dateISO);
      const menuDate = orderDate;

      if (isOrderLockedForDate(orderDate)) {
        continue; 
      }

      const byCat = (cat: string) =>
        (m.options ?? []).filter((o: any) => o.category === cat);

      const pickDefault = (cat: string) => {
        const arr = byCat(cat);
        if (arr.length === 0) return null;
        return arr.find((o: any) => o.isDefault) ?? arr[0];
      };

      const soup = pickDefault('SOUP');
      const main = pickDefault('MAIN');
      const dessert = pickDefault('DESSERT');
      const reserve = pickDefault('RESERVE');

      if (!soup || !main || !dessert) continue;

      const selections = [
        { category: 'SOUP', optionId: soup.id },
        { category: 'MAIN', optionId: main.id },
        { category: 'DESSERT', optionId: dessert.id },
        ...(reserve ? [{ category: 'RESERVE', optionId: reserve.id }] : []),
      ];

      const snapshot = selections.map((s) => {
        const opt = (m.options ?? []).find((o: any) => o.id === s.optionId);
        return { ...s, optionName: opt?.name ?? '' };
      });

      const choicesJson = selections as unknown as Prisma.InputJsonValue;
      const snapshotJson = snapshot as unknown as Prisma.InputJsonValue;

      ops.push(
        this.prisma.order.upsert({
          where: {
            childId_orderDate: {
              childId: dto.childId,
              orderDate,
            },
          },
          create: {
            parentSub,
            parentEmail,
            childId: dto.childId,
            orderDate,
            menuDate,
            menuId: m.id,
            status: OrderStatus.PENDING,
            selection: {
              create: {
                choices: choicesJson,
                snapshot: snapshotJson,
              },
            },
          },
          update: {
            parentEmail,
            menuDate,
            menuId: m.id,
            status: OrderStatus.PENDING,
            selection: {
              upsert: {
                create: { choices: choicesJson, snapshot: snapshotJson },
                update: { choices: choicesJson, snapshot: snapshotJson },
              },
            },
          },
          include: { selection: true },
        }),
      );
    }

    const result = await this.prisma.$transaction(ops);

    return {
      ok: true,
      createdOrUpdated: result.length,
      from: dto.from,
      to: dto.to,
    };
  }

  public async confirmTodayForce() {
    const pending = await this.prisma.$queryRaw<any[]>`
    SELECT o.id, o.childId, o.parentSub, o.parentEmail, o.orderDate, os.snapshot
    FROM \`Order\` o
    LEFT JOIN OrderSelection os ON os.orderId = o.id
    WHERE o.status = 'PENDING'
      AND DATE(o.orderDate) = CURDATE()
  `;

    if (pending.length === 0) return { ok: true, confirmed: 0 };

    await this.prisma.$executeRaw`
    UPDATE \`Order\`
    SET status = 'CONFIRMED'
    WHERE status = 'PENDING'
      AND DATE(orderDate) = CURDATE()
  `;

    for (const o of pending) {
      const snap = (o.snapshot as any[]) || [];
      const pick = (cat: string) =>
        snap.find((x: any) => x.category === cat)?.optionName || '';

      await this.publisher.publishOrderConfirmed({
        orderId: o.id,
        orderDate: String(o.orderDate).slice(0, 10),
        child: { id: o.childId, name: '', class: '' },
        parent: { sub: o.parentSub, email: o.parentEmail },
        menu: {
          soup: pick('SOUP'),
          main: pick('MAIN'),
          dessert: pick('DESSERT'),
          reserve: pick('RESERVE'),
        },
      });
    }

    return { ok: true, confirmed: pending.length };
  }
}
