import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MenusClient } from '../clients/menus.client';
import { UsersClient } from '../clients/users.client';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { isAfterCutoffForDate, parseISODateOnly } from '../common/time';

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
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menusClient: MenusClient,
    private readonly usersClient: UsersClient,
  ) {}

  private extractBearer(req: any): string {
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return '';
    return auth.substring('Bearer '.length);
  }

  async placeOrder(req: any, dto: PlaceOrderDto) {
    const user = req.user as { sub: string; email?: string; roles?: string[] };
    if (!user?.sub) throw new ForbiddenException('Missing user context');

    const parentSub = user.sub;
    const parentEmail = user.email ?? '';

    // 1) parse dates
    const orderDate = parseISODateOnly(dto.orderDate);
    const menuDate = orderDate;

    // 2) cutoff
    if (isAfterCutoffForDate(orderDate)) {
      throw new BadRequestException(
        'Cutoff passed for today (09:00). Cannot place/update order.',
      );
    }

    // 3) child ownership via user-service (token user)
    const userToken = this.extractBearer(req);
    if (!userToken) throw new ForbiddenException('Missing bearer token');

    await this.usersClient.assertChildBelongsToParent(dto.childId, userToken);

    // 4) validate against menu-service (token service inside MenusClient)
    const validation = (await this.menusClient.validateOrder({
      dailyMenuId: dto.dailyMenuId,
      orderDate: dto.orderDate,
      selections: dto.selections,
    })) as MenuValidationResponse;

    if (!validation?.ok) {
      throw new BadRequestException('Menu validation failed');
    }

    // 5) check existing for ownership rule
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

    // 6) JSON casting for Prisma
    const choicesJson =
      dto.selections as unknown as Prisma.InputJsonValue;

    const snapshotJson =
      (validation.normalizedSelections ?? null) as unknown as Prisma.InputJsonValue;

    // 7) upsert
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

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.parentSub !== user.sub) {
      throw new ForbiddenException('Cannot cancel order not owned by you');
    }

    if (isAfterCutoffForDate(order.orderDate)) {
      throw new BadRequestException(
        'Cutoff passed for today (09:00). Cannot cancel order.',
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
}
