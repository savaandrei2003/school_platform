import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MenusClient } from '../clients/menus.client';
import { UsersClient } from '../clients/users.client';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { isAfterCutoffForDate, parseISODateOnly } from '../common/time';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private menusClient: MenusClient,
    private usersClient: UsersClient,
  ) {}

  private extractBearer(req: any): string {
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return '';
    return auth.substring('Bearer '.length);
    }

  async placeOrder(req: any, dto: PlaceOrderDto) {
    const { sub, email } = req.user as { sub: string; email: string; roles: string[] };

    // 1) parse date (YYYY-MM-DD)
    const orderDate = parseISODateOnly(dto.orderDate);
    const menuDate = parseISODateOnly(dto.menuDate ?? dto.orderDate);

    // 2) cutoff: dacă e azi și e după 09:00 -> nu mai poți
    if (isAfterCutoffForDate(orderDate)) {
      throw new BadRequestException('Cutoff passed for today (09:00). Cannot place/update order.');
    }

    // 3) verify child ownership via user-service (recomandat)
    const token = this.extractBearer(req);
    if (!token) throw new ForbiddenException('Missing bearer token');

    await this.usersClient.assertChildBelongsToParent(dto.childId, token);

    // 4) validate choices against menu-service
    const validation = await this.menusClient.validateOrder({
      date: dto.orderDate,
      choices: dto.choices,
    });

    // 5) upsert Order by (childId, orderDate)
    const existing = await this.prisma.order.findUnique({
      where: {
        childId_orderDate: {
          childId: dto.childId,
          orderDate,
        },
      },
      include: { selection: true },
    });

    if (existing && existing.status === 'CANCELED') {
      // dacă vrei să permiți re-plasare după cancel înainte de cutoff
      // îl “reactivezi”
    }

    const order = await this.prisma.order.upsert({
      where: {
        childId_orderDate: {
          childId: dto.childId,
          orderDate,
        },
      },
      create: {
        parentSub: sub,
        parentEmail: email,
        childId: dto.childId,
        orderDate,
        menuDate,
        menuId: validation.menuId,
        status: 'PENDING',
        selection: {
          create: {
            choices: dto.choices,
            snapshot: validation.snapshot ?? undefined,
          },
        },
      },
      update: {
        // doar owner-ul poate modifica
        ...(existing && existing.parentSub !== sub
          ? (() => {
              throw new ForbiddenException('Cannot modify order not owned by you');
            })()
          : {}),

        parentEmail: email,
        menuDate,
        menuId: validation.menuId,
        status: 'PENDING',
        selection: existing?.selection
          ? {
              update: {
                choices: dto.choices,
                snapshot: validation.snapshot ?? undefined,
              },
            }
          : {
              create: {
                choices: dto.choices,
                snapshot: validation.snapshot ?? undefined,
              },
            },
      },
      include: { selection: true },
    });

    return order;
  }

  async cancelOrder(req: any, orderId: string) {
    const { sub } = req.user as { sub: string };

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new BadRequestException('Order not found');

    if (order.parentSub !== sub) {
      throw new ForbiddenException('Cannot cancel order not owned by you');
    }

    if (isAfterCutoffForDate(order.orderDate)) {
      throw new BadRequestException('Cutoff passed for today (09:00). Cannot cancel order.');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELED', canceledAt: new Date() },
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
