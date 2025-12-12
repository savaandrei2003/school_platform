import { Controller, Get, Req, UseGuards, Delete, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { KeycloakAuthGuard } from '../auth/keycloak-auth.guard';
import { Roles } from 'src/auth/role.decorator';
import { RolesGuard } from 'src/auth/role.guards';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(KeycloakAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    const { sub, email, roles } = req.user;

    const result = await this.usersService.provisionUserAndGetChildren({
      sub,
      email,
      roles,
    });

    return result;
  }

  @UseGuards(KeycloakAuthGuard)
  @Get('children')
  async getMyChildren(@Req() req: any) {
    return this.usersService.getChildrenForParent(req.user.sub);
  }

  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':userId')
  deleteUser(@Param('userId') userId: string) {
    return this.usersService.deleteUser(userId);
  }
}
