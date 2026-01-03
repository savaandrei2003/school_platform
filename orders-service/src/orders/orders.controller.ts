import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { KeycloakAuthGuard } from '../auth/keycloak-auth.guard';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { PlaceMonthDefaultsDto } from './dto/place-month-defaults.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @UseGuards(KeycloakAuthGuard)
  @Post()
  async place(@Req() req: any, @Body() dto: PlaceOrderDto) {
    return this.orders.placeOrder(req, dto);
  }

  @UseGuards(KeycloakAuthGuard)
  @Delete(':id')
  async cancel(@Req() req: any, @Param('id') orderId: string) {
    return this.orders.cancelOrder(req, orderId);
  }

  @UseGuards(KeycloakAuthGuard)
  @Get()
  async listMine(@Req() req: any, @Query() q: ListOrdersQueryDto) {
    return this.orders.listForParent(req.user.sub, q);
  }

  @UseGuards(KeycloakAuthGuard)
  @Get('today')
  async today(@Req() req: any) {
    return this.orders.listToday(req.user.sub);
  }

  @UseGuards(KeycloakAuthGuard)
  @Post('monthly-defaults')
  async monthlyDefaults(@Req() req: any, @Body() dto: PlaceMonthDefaultsDto) {
    return this.orders.placeMonthlyDefaults(req, dto);
  }
}
