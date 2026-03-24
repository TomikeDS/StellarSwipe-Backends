import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExplorerService } from './explorer.service';
import { ExplorerController } from './explorer.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ExplorerController],
  providers: [ExplorerService],
  exports: [ExplorerService],
})
export class ExplorerModule {}
