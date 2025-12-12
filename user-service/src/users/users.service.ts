import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type KeycloakUserInfo = {
  sub: string;
  email: string;
  roles: string[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRole(roles: string[]): 'parent' | 'teacher' | 'admin' {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('teacher')) return 'teacher';
    return 'parent';
  }

  async provisionUserAndGetChildren(info: KeycloakUserInfo) {
    const { sub, email, roles } = info;

    // 1. verificăm dacă utilizatorul există în MySQL
    let user = await this.prisma.appUser.findUnique({
      where: { id: sub },
    });

    // 2. dacă nu există → îl creăm
    if (!user) {
      user = await this.prisma.appUser.create({
        data: {
          id: sub,
          email,
          role: this.mapRole(roles),
        },
      });

      // atașăm copiii din bază după email-ul părintelui
      await this.prisma.child.updateMany({
        where: {
          parentEmail: email,
          parentId: null,
        },
        data: {
          parentId: sub,
        },
      });
    }

    // 3. obținem copiii legați de acest utilizator
    const children = await this.prisma.child.findMany({
      where: { parentId: sub },
    });

    return { user, children };
  }

  async getChildrenForParent(parentId: string) {
    return this.prisma.child.findMany({
      where: { parentId },
    });
  }
}
