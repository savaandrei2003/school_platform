import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyMenuDto } from './dto/create-daily-menu.dto';
import { ValidateOrderDto } from './dto/validate-order.dto';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async createDailyMenu(dto: CreateDailyMenuDto) {
    const date = new Date(dto.date);

    const defaultsByCategory = new Map<string, number>();
    for (const opt of dto.options) {
      if (opt.isDefault) {
        defaultsByCategory.set(
          opt.category,
          (defaultsByCategory.get(opt.category) ?? 0) + 1,
        );
      }
    }
    for (const [cat, cnt] of defaultsByCategory.entries()) {
      if (cnt > 1)
        throw new BadRequestException(`Multiple defaults for category ${cat}`);
    }

    try {
      return await this.prisma.dailyMenu.create({
        data: {
          date,
          title: dto.title,
          options: {
            create: dto.options.map((o) => ({
              category: o.category,
              name: o.name,
              allergens: o.allergens ?? undefined,
              isDefault: o.isDefault ?? false,
            })),
          },
        },
        include: { options: true },
      });
    } catch (e: any) {

      throw new BadRequestException('DailyMenu already exists for this date');
    }
  }

  async getByDate(dateStr: string) {
    const date = new Date(dateStr);
    const menu = await this.prisma.dailyMenu.findUnique({
      where: { date },
      include: { options: true },
    });
    if (!menu) throw new NotFoundException('Menu not found for date');
    return menu;
  }

  async getById(id: string) {
    const menu = await this.prisma.dailyMenu.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    return menu;
  }


  async validateOrder(dto: ValidateOrderDto) {
    const menu = await this.prisma.dailyMenu.findUnique({
      where: { id: dto.dailyMenuId },
      include: { options: true },
    });
    if (!menu) throw new NotFoundException('DailyMenu not found');

    const orderDate = new Date(dto.orderDate);
    const menuDateISO = menu.date.toISOString().slice(0, 10);
    const orderDateISO = orderDate.toISOString().slice(0, 10);
    if (menuDateISO !== orderDateISO) {
      throw new BadRequestException('dailyMenuId does not match orderDate');
    }

    const optionsById = new Map(menu.options.map((o) => [o.id, o]));
    for (const sel of dto.selections) {
      const opt = optionsById.get(sel.optionId);
      if (!opt)
        throw new BadRequestException(
          `Option ${sel.optionId} not in this menu`,
        );
      if (opt.category !== sel.category) {
        throw new BadRequestException(
          `Option ${sel.optionId} category mismatch`,
        );
      }
    }

    return {
      ok: true,
      menuId: menu.id,
      date: menuDateISO,
      normalizedSelections: dto.selections.map((s) => ({
        category: s.category,
        optionId: s.optionId,
        optionName: optionsById.get(s.optionId)!.name,
      })),
    };
  }

   async getRange(fromStr: string, toStr: string) {
    const from = new Date(fromStr);
    const to = new Date(toStr);

    to.setHours(23, 59, 59, 999);

    return this.prisma.dailyMenu.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      include: { options: true },
    });
  }
}
