import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MenusService } from './menus.service';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  createMenu(
    @Body('date') date: string,
    @Body('title') title: string,
  ) {
    return this.menusService.createMenu(date, title);
  }

  @Post('item')
  addItem(
    @Body('menuId') menuId: string,
    @Body('name') name: string,
    @Body('allergens') allergens?: any,
  ) {
    return this.menusService.addItem(menuId, name, allergens);
  }

  @Get()
  getMenu(@Query('date') date: string) {
    return this.menusService.getMenuByDate(date);
  }
}
