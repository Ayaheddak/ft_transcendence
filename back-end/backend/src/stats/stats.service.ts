import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameHistory } from 'src/entities/GameHistory.entity';
import { UserService } from 'src/user/user.service';
import { Equal, Repository } from 'typeorm';

@Injectable()
export class StatsService {
  constructor(
      private readonly userService: UserService,
    @InjectRepository(GameHistory)
    private readonly gameHistoryervice: Repository<GameHistory>
  ) {}
  async getStats() {
    const users = await this.userService.findAllUsers();
    if (!users || users[0].gameStats == null)
      throw new HttpException("the users is not not found", 404)
    const userStats = users.map((user) => {
      return {
        id: user.id,
        name: user.username,
        xp: user.gameStats.xp,
        win: user.gameStats.victories,
        lose: user.gameStats.defeats,
        games: user.gameStats.games
      }
    }).sort((a, b) => b.xp - a.xp)
    return userStats;
  }

async getGameHistory(username: string) {

    const user = await this.userService.findUserByUn(username);
    if (!user || user.gameStats == null)
      throw new HttpException("the users is not not found", 404)
    const gamesHistory = await this.gameHistoryervice.find({where: [{winner: Equal(user.id)}, {loser: Equal(user.id)}], relations: ['winner','loser']});
    const userhis = gamesHistory.map((his) => {
      if(his.winner.id == user.id)
        return {
          id: user.id,
          opponent: his.loser.username,
          fullName: his.loser.fullname,
          result: "win",
          date: his.date.split("at")[0],
          time: his.date.split("at")[1],
      }
        else
          return {
          id: user.id,
          opponent: his.winner.username,
          fullName: his.winner.fullname,
          result: "lose",
          date: his.date.split("at")[0],
          time: his.date.split("at")[1],
      }
    }).reverse()
    return (userhis);
  }
}
