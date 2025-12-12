import { Module } from '@nestjs/common';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [KeycloakAuthGuard],
  exports: [KeycloakAuthGuard],
})
export class AuthModule {}
