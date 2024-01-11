import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('stats')
  async getStats() {
    try
    {
      const Usergamestats = await this.statsService.getStats();
      console.log("the profile is game history ===> ", Usergamestats)
      return  Usergamestats;
    } 
    catch (error) {
        console.error("there is an error here");
        throw error;
    }
}
  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  async gethistory (@Req() req: any) {
    try
    {
        console.log("the username ", req.user)
        const history = await this.statsService.getGameHistory(req.user.username);
        console.log("the game his ", history);
        return (history);
    } 
    catch (error) {
        console.error("there is an error here");
        throw error;
    }
  }
}
