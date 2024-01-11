import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameHistory } from 'src/entities/GameHistory.entity';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([GameHistory])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
