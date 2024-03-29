import { Module } from '@nestjs/common';
import { DatadaShboard, Dataprofile } from './data';
import { UserModule } from 'src/user/user.module';
import { FriendModule } from 'src/friend/friend.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedList } from 'src/entities/BlockedList.entity';
import { GameHistory } from 'src/entities/GameHistory.entity';

@Module({
  imports: [UserModule, FriendModule, TypeOrmModule.forFeature([BlockedList , GameHistory])],
  providers: [Dataprofile, DatadaShboard],
  exports: [Dataprofile, DatadaShboard],
})
export class DataModule {}
