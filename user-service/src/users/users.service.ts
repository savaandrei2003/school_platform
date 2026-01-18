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

    let user = await this.prisma.appUser.findUnique({
      where: { id: sub },
    });

    let message = '';

    if (!user) {
      user = await this.prisma.appUser.create({
        data: {
          id: sub,
          email,
          role: this.mapRole(roles),
        },
      });


      message = 'User created successfully';
    } else {
      message = 'User already exists';
    }

    await this.prisma.child.updateMany({
      where: { parentEmail: email, parentId: null },
      data: { parentId: sub },
    });

    const children = await this.prisma.child.findMany({
      where: { parentId: sub },
    });
    

    return { user, children, message };
  }

  async getChildrenForParent(parentId: string) {
    return this.prisma.child.findMany({
      where: { parentId },
    });
  }

  async deleteUser(userId: string) {
    await this.prisma.child.deleteMany({
      where: { parentId: userId },
    });

    await this.prisma.appUser.delete({
      where: { id: userId },
    });
  }
}
