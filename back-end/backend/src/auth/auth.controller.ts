import { Controller, Get, HttpException, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express'
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';

@Controller('auth')
export class AuthController {
    constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userReposite: Repository<User>
    ){}


    @Get('login/google')
    @UseGuards(AuthGuard('google'))
    loging() {
        return ({msg: "the authentication is done well ;)"});
  }


      @Get('google/callback')
      @UseGuards(AuthGuard('google'))
      async googleLoginCallback(@Req() req: any , @Res({ passthrough: true }) res: Response ) {
    // console.log("here is user informations :" + JSON.stringify(req.user.profile, null, 2));
    // console.log("profile here ===========" +( req));
    // const accessToken:  string = await this.authService.create_jwt({
    //     email: req.user.profile.emails[0].value,
    //     username: req.user.profile.emails[0].value.split("@")[0] + "_g",
    //     avatar: req.user.profile.photos[0].value
    //   });
    try {

    if (req.user.user.username == null || req.user.user.username == undefined)
      throw new HttpException("the user not found", 404);
    const user = await this.userReposite.findOne({where: {username: req.user.user.username}})
    if (user == null)
      throw new HttpException("the user is not found", 404);
    const accessToken:  string = await this.authService.create_jwt({
        email: user.email,
        username: user.username,
        avatar: user.Avatar,
        fullname: user.username
      });
    if (req.user.isFirst == true)
    {
      res.cookie('accessToken', accessToken);
      console.log("the url of the host front ---", accessToken)
      res.redirect(process.env.HOST_F + "FirstTime");
    }
    else if (user.is_twofactor == false)
    {
      res.cookie('accessToken', accessToken);
      res.redirect(process.env.HOST_F + "CallBack");
    }
    else
    {
      res.cookie('username', user.username);
      res.redirect(process.env.HOST_F + "welcomeback");
    }
      // const accessTokenCookie = `accessToken=${accessToken}; HttpOnly; domain=.localhost; Max-Age=${6000 * 60}; SameSite=Strict`;
    } catch (error) {
      console.log("the user is not found");
      throw error ;
    }
  }


    @Get('login/FortyTwo')
    @UseGuards(AuthGuard('FortyTwo'))
    loginng() {
        return ({msg: "the authentication is done well ;)"});
  }
      @Get('FortyTwo/callback')
      @UseGuards(AuthGuard('FortyTwo'))
      async FortyTwoLoginCallback(@Req() req: any , @Res() res: Response ) {
    // console.log("profile here ===========");
    try
    {
    if (req.user.user.username == null || req.user.user.username == undefined)
      throw new HttpException("the user not found", 404);
    const user = await this.userReposite.findOne({where: {username: req.user.user.username}})
    if (!user)
      throw new HttpException("the user not found", 404);
    const accessToken:  string = await this.authService.create_jwt({
        email: user.email,
        username: user.username,
        avatar: user.Avatar,
        fullname: user.username
      });
    if (req.user.isFirst == true)
    {
      res.cookie('accessToken', accessToken);
      console.log("the url of the host front ---", accessToken)
      res.redirect(process.env.HOST_F + "FirstTime");
    }
    else if (user.is_twofactor == false)
    {
      res.cookie('accessToken', accessToken);
      console.log("the url of the host sf front ---", accessToken)
      res.redirect(process.env.HOST_F + "Callback");
    }
    else
    {
      res.cookie('username', user.username);
      res.redirect(process.env.HOST_F + "welcomeback");
    }
    } catch (error) {
        console.log("the user is not found");
        throw error ;
    }
  }
}
