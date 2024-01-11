import { Controller, Get, HttpException, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DatadaShboard } from 'src/data/data';

@Controller('dashboard')
export class DashboardController {
  constructor (private readonly datadashboard: DatadaShboard)
  {}
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async get_dashboard_info (@Req() req: any) {
    try
    {
        if (req.user.username == null || req.user.username == undefined)
            throw new HttpException("the user was not found", 404);
        return (this.datadashboard.getInfodashboard(req.user.username));
    }
    catch (error)
    {
        console.error("an error was found ")
        throw error;
    }
  }
}
