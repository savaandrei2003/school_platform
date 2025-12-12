import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { KeycloakAuthGuard } from '../auth/keycloak-auth.guard';
import { RolesGuard } from '../auth/role.guards';
import { Roles } from 'src/auth/role.decorator';

@Controller('admin/children')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('admin')
export class AdminChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Post()
  async createChild(@Body() dto: CreateChildDto) {
    return this.childrenService.createChild(dto);
  }
}
