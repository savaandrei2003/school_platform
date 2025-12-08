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

  private mapRole(roles: string[]): 'parent' | 'teacher' | 'admin' | 'child' {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('teacher')) return 'teacher';
    // pentru moment default: parent
    return 'parent';
  }

  async provisionUserAndGetChildren(info: KeycloakUserInfo) {
    const { sub, email, roles } = info;

    let user = await this.prisma.appUser.findUnique({
      where: { id: sub },
    });

    if (!user) {
      user = await this.prisma.appUser.create({
        data: {
          id: sub,
          email,
          role: this.mapRole(roles),
        },
      });

      // prima logare: atașăm copii prin parentEmail
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

    const children = await this.prisma.child.findMany({
      where: { parentId: sub },
    });

    return { user, children };
  }

  async getChildForUser(childId: string, parentId: string) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child || child.parentId !== parentId) {
      return null;
    }

    return child;
  }
}
