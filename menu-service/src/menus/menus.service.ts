import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  createMenu(date: string, title: string) {
    return this.prisma.menu.create({
      data: {
        date: new Date(date),
        title,
      },
    });
  }

  addItem(menuId: string, name: string, allergens?: any) {
    return this.prisma.menuItem.create({
      data: {
        name,
        allergens,
        menuId,
      },
    });
  }

  getMenuByDate(date: string) {
    return this.prisma.menu.findFirst({
      where: {
        date: new Date(date),
      },
      include: {
        items: true,
      },
    });
  }
}
