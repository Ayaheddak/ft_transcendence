import { UserService } from "src/user/user.service";
import { HttpException, Injectable } from "@nestjs/common";
import { FriendService } from "src/friend/friend.service";
import { User } from "src/entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Equal, Repository } from "typeorm";
import { BlockedList } from "src/entities/BlockedList.entity";
import { GameStats } from "src/entities/game.entity";
import { GameHistory } from "src/entities/GameHistory.entity";

@Injectable()
export class Dataprofile {
  constructor(
    private readonly friendService: FriendService,
    private readonly userService: UserService,
    @InjectRepository(BlockedList)
    private readonly blockedList: Repository<BlockedList>,
    @InjectRepository(GameHistory)
    private readonly gameHistoryervice: Repository<GameHistory>
  ) {}

  async getUserprofile(username1: string, username2: string) {
    var friend: boolean = false;
    var friendRequest: boolean = false;
    var friendRequestSent: boolean = false;
    // console.log("this is the username1", username1);
    // console.log("this is the username2", username2);
    if (username2 == undefined || username1 == undefined) {
      console.log("the username is not found");
      throw new HttpException("error ", 404);
    }
      console.log("the username is ", username1, "the username", username2);
    const user1 = await this.userService.findUserByUn(username1);
    const user2 = await this.userService.findUserByUn(username2);
    // console.log("the user1 ", user1, "the user 2 ", user2)
    if (user2 == null || user1 == null)
     {
      console.log("the username is not found");
      throw new HttpException("the user not found", 404);
     }
    const friendU = await this.friendService.findOne(user1, user2);
    if (friendU && friendU.Status === "accepted") friend = true;
    else if (
      (friendU && friendU.Status === "pending",
      user1.friendship_sender.find(() => friendU))
    )
      friendRequest = true;
    else if (
      (friendU && friendU.Status === "pending",
      user1.friendship_reciver.find(() => friendU))
    )
      friendRequestSent = true;
    console.log(
      "is it friend =======> ",
      friend,
      "is it friend request=====> ",
      friendRequest,
      "is it friendRequestSent=====> ",
      friendRequestSent
    );
    const blockedList = await this.blockedList.findOne({where: [{Blocker : Equal(user1.id), BlockedUser: Equal(user2.id)}, {Blocker : Equal(user2.id), BlockedUser: Equal(user1.id)}]})
    var blocked : boolean = false;
    var blocker: boolean =false;
    var username: string;
    if (user1.blocker.find(() => blockedList))
    {
      console.log("the user one blocked the user two")
      blocker = true;
      username = user2.username;
    }
    else if (user2.blocker.find(() => blockedList))
    {
      console.log("the user two blocked the user one")
      blocked = true;
      username = user2.username;
    }
    const gamesHistory = await this.gameHistoryervice.find({where: [{winner: Equal(user2.id)}, {loser: Equal(user2.id)}], relations: ['winner','loser']});
    if (!gamesHistory)
      throw new HttpException("the game history was not found", 404);
    const userhis = gamesHistory.map((his) => {
      if(his.winner.id == user2.id)
        return {
          id: user1.id,
          opponent: his.loser.username,
          fullName: his.loser.fullname,
          result: "win",
          date: his.date.split("at")[0],
          time: his.date.split("at")[1],
      }
        else
          return {
          id: user2.id,
          opponent: his.winner.username,
          fullName: his.winner.fullname,
          result: "lose",
          date: his.date.split("at")[0],
          time: his.date.split("at")[1],
      }
    }).reverse()
    const profileUser = {
      blocked: blocked,
      blocker: blocker,
      username: user2.username,
      fullName: user2.fullname,
      image: user2.Avatar,
      level: user2.gameStats.level,
      xp: user2.gameStats.xp,
      position: 23,
      games: user2.gameStats.games,
      lose: user2.gameStats.defeats,
      win: user2.gameStats.victories,
      state: user2.status,
      friend: friend,
      friendRequest: friendRequest,
      friendRequestSent: friendRequestSent,
      gamesHistory: userhis,
    };
    // console.log("this is the profile user", profileUser);
    return profileUser;
  }

  async getInfoprofile(username: string) {
    const user = await this.userService.findUserByUn(username);
    if (!user)
      throw new HttpException("the user not found", 404);
    // console.log("his this the user===>" + JSON.stringify(user));
    return {
      editInnfo: {
        id: user.id,
        username: user.username,
        avatar: user.Avatar,
      },
      profileInfo: {
        image: user.Avatar,
        fullName: user.fullname,
        username: user.username,
        level: user.gameStats.level,
        games: user.gameStats.games,
        win: user.gameStats.victories,
        lose: user.gameStats.defeats,
        xp: user.gameStats.xp,
        state: user.status,
      },
      gameStatus: {
        leaderBoard: [
          {
            username: "user1",
          },
          {
            username: "user2",
          },
          {
            username: "user3",
          },
        ],
        win: 37,
        lose: 13,
        games: 50,
        acheivement: [],
      },
    };
  }
}

@Injectable()
export class DatadaShboard {
  constructor(private readonly userService: UserService,
    // @InjectRepository(GameStats)
    // private readonly gameStatservice: Repository<GameStats>,
    @InjectRepository(GameHistory)
    private readonly gameHistoryervice: Repository<GameHistory>
  ) {}
  async get_lastMessages(user: User) {
    const Messages = user.receivedMessages.reverse();
    return Messages;
  }

  async getInfodashboard(username: string) {
    const user = await this.userService.findUserByUn(username);
    if (!user)
        throw new HttpException("the user not found", 404);
    const gameStatus = user.gameStats;
    const gamesHistory = await this.gameHistoryervice.find({where: [{winner: Equal(user.id)}, {loser: Equal(user.id)}], relations: ['winner','loser']});
    if (!gamesHistory)
        throw new HttpException("the game history was not found", 404);
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
    const last4Msg = await this.get_lastMessages(user);
    console.log("LAAAAST 444444 MEiSSAGEGEGEGEGEGGEGEGE", last4Msg);
    const mostRecentMessages = last4Msg.filter((message, index, self) => {
  // Find the index of the first occurrence of the sender in the array
      const firstIndexOfSender = self.findIndex(m => m.SenderUserID.id === message.SenderUserID.id);

  // Return true only if the current message is the first occurrence of the sender
  return index === firstIndexOfSender;
});
    console.log("lasssstttttt messssgeeeee----", mostRecentMessages)
    const ls = mostRecentMessages.map((element) => {
      return{
          id: element.SenderUserID.id,
          username: element.SenderUserID.username,
          image: element.SenderUserID.Avatar,
          lastMessage: element.Content,
          status: element.SenderUserID.status,
          ischannel: false,
      }
    }).splice(0,3)
    return {
      user: {
        id: user.id,
        username: user.username,
        image: user.Avatar,
        status: user.status,
        fullName: user.fullname,
        level: gameStatus.level,
        games: gameStatus.games,
        win: gameStatus.victories,
        lose: gameStatus.defeats,
      },
      last4Msg: ls,
      last6Games: userhis,
    };
  }
}
