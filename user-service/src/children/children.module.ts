import { Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminChildrenController } from './admin-children.controller';

@Module({
  imports: [PrismaModule],
  providers: [ChildrenService],
  controllers: [AdminChildrenController],
  exports: [ChildrenService],
})
export class ChildrenModule {}