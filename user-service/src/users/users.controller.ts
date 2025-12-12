import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { KeycloakAuthGuard } from '../auth/keycloak-auth.guard';

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

    return result; // { user: AppUser, children: Child[] }
  }

  @UseGuards(KeycloakAuthGuard)
  @Get('children')
  async getMyChildren(@Req() req: any) {
    return this.usersService.getChildrenForParent(req.user.sub);
  }
}
