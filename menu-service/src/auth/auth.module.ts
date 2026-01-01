import { Module } from '@nestjs/common';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { RolesGuard } from './role.guards';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [KeycloakAuthGuard, RolesGuard],
  exports: [KeycloakAuthGuard, RolesGuard],
})
export class AuthModule {}