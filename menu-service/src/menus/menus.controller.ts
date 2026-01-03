import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateDailyMenuDto } from './dto/create-daily-menu.dto';
import { ValidateOrderDto } from './dto/validate-order.dto';
import { KeycloakAuthGuard } from '../auth/keycloak-auth.guard';
import { Roles } from '../auth/role.decorator';
import { RolesGuard } from '../auth/role.guards';

@Controller('menus')
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  // ADMIN: creează meniul zilei
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('daily')
  async createDaily(@Body() dto: CreateDailyMenuDto) {
    return this.menus.createDailyMenu(dto);
  }

  // oricine autentificat poate vedea meniul zilei (sau poți lăsa public)
  @UseGuards(KeycloakAuthGuard)
  @Get('daily')
  async getByDate(@Query('date') date: string) {
    return this.menus.getByDate(date);
  }

  @UseGuards(KeycloakAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.menus.getById(id);
  }

  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('service')
  @Post('internal/validate-order')
  async validateOrder(@Body() dto: ValidateOrderDto) {
    return this.menus.validateOrder(dto);
  }

  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('service')
  @Get('internal/range')
  async getRange(@Query('from') from: string, @Query('to') to: string) {
    return this.menus.getRange(from, to);
  }
}
