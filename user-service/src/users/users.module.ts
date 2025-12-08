import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KeycloakAuthGuard } from '../auth/keycloak-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, KeycloakAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
