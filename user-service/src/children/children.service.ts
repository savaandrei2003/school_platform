import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChildDto } from './dto/create-child.dto';

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async createChild(dto: CreateChildDto) {
    return this.prisma.child.create({
      data: {
        name: dto.name,
        class: dto.class,
        parentEmail: dto.parentEmail,
        allergies: dto.allergies ?? [],
        parentId: null,
      },
    });
  }

  async getChildrenForParent(parentId: string) {
    return this.prisma.child.findMany({
      where: { parentId },
    });
  }
}
