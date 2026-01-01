import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MenusModule } from './menus/menus.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    MenusModule,
  ],
})
export class AppModule {}