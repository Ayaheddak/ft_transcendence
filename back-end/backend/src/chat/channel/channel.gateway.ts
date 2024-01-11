import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ChatService } from "../chat.service";
import { Socket, Server } from "socket.io";
import { UserService } from "src/user/user.service";
import { ChannelService } from "./channel.service";
import { subscribe } from "diagnostics_channel";
import * as jwtDecode from "jwt-decode";
import { HttpException } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class ChannelGateway {
  constructor(
    private readonly channelService: ChannelService,
    private readonly userService: UserService
  ) {}
  @WebSocketServer() server: Server;

  @SubscribeMessage("createChannel")
  async handleCreateChannel(
    client: Socket,
    channelData: {
      ownerId: number;
      channelName: string;
      channelType: string;
      password?: string;
    }
  ) {

    try {
    const ownerId = channelData.ownerId;
    const channelName = channelData.channelName;
    const channelType = channelData.channelType;
    const password = channelData.password;

    const newchannel = await this.channelService.createChannelForUser(
      ownerId,
      channelName,
      channelType,
      password
    );
    if (channelType === "private") {
      this.server.to(ownerId.toString()).emit("newChannelCreated", newchannel);
    } else {
      this.server.emit("newChannelCreated", newchannel);
    }
  } catch (error) {
    console.error("Error creating channel:", error);
  }
  }

  @SubscribeMessage("getUserChannels")
  async handleGetUserChannels(client: Socket, userId: number) {
    try {
      const userChannels = await this.channelService.getUserChannels(userId);

      client.emit("userChannels", userChannels);
    } catch (error) {
      console.error("Error fetching user channels:", error);
    }
  }

  @SubscribeMessage("joinChannel")
  async handleJoinChannel(
    client: Socket,
    data: { channelId: number; userId: number; password?: string }
  ) {
    const { channelId, userId, password } = data;

    try {
      await this.channelService.joinChannel(channelId, userId, password);
      const message = await this.channelService.getChannelMessages(channelId);
      client.join(`channel-${channelId}`);

      const channelType = await this.channelService.getChannelType(channelId);
      client.emit("channelType", { channelId, channelType });

      const mess = message;

      const sockets = await this.server.to(`channel-${channelId}`).fetchSockets()
      await Promise.all(sockets.map(async (element) => {
        const paylo: any = jwtDecode.jwtDecode(client.handshake.auth.token)
        const message = await Promise.all(mess.map(async (mess) => {
          const user1 = await this.userService.findUserById(paylo.id)
          const user2 = await this.userService.findUserById(mess.senderId)
          const isblocked = await this.channelService.IsBlocked(user1, user2)
          if (!isblocked)
            return mess;
          return (
            {
              id: mess.id,
              Content: "Hidden Message",
              Timestamp: mess.Timestamp,
              senderId: mess.senderId,
              username: mess.username,
              avatar: mess.avatar,
            })
        }))


        client.emit("channelMessages", {channelId, message })
      }))

      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.userId
      );
      const channel = await this.channelService.getChannelById(channelId);
      const ownerId = channel.owner.id;
      const members = await this.channelService.getChannelMembers(channelId);
      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server.to(ownerId.toString()).emit("channelMembers", members);

      client.emit("channelMembershipStatus", {
        channelId: data.channelId,
        ...status,
      });
      // }
    } catch (error) {
      console.error("Error joining channel:", error);
    }
  }


  @SubscribeMessage("getChannelMessages")
  async handleGetChannelMessages(client: Socket, data : {channelId: number, currentUserId: number}) {
    try {

      const { channelId, currentUserId } = data;
      const mess = await this.channelService.getChannelMessages(channelId);

      client.emit("channelMessages", {channelId, mess });


      const channel = await this.channelService.getChannelById(channelId);
          const ownerId = channel.owner.id;
      const sockets = await this.server.to(`channel-${channelId}`).fetchSockets()
      await Promise.all(sockets.map(async (element) => {
        const paylo: any = jwtDecode.jwtDecode(client.handshake.auth.token)
        const message = await Promise.all(mess.map(async (mess) => {
          const user1 = await this.userService.findUserById(paylo.id)
          if(!user1 )
            throw new HttpException("the user is not found", 404);
          const user2 = await this.userService.findUserById(mess.senderId)
          const isblocked = await this.channelService.IsBlocked(user1, user2)
          if (!isblocked)
            return mess;
          return (
            {
              id: mess.id,
              Content: "Hidden Message",
              Timestamp: mess.Timestamp,
              senderId: mess.senderId,
              username: mess.username,
              avatar: mess.avatar,
            })
        }))

        client.emit("channelMessages", {channelId, message })
      }))
      const message = mess; 
      if(currentUserId == ownerId){

        this.server.to(ownerId.toString()).emit("channelMessages", {channelId, message});
      }

    } catch (error) {
      console.error("Error fetching channel messages:", error);
    }
  }


  @SubscribeMessage("sendMessageToChannel")
  async handleSendMessageToChannel(
    client: Socket,
    data: { channelId: number; senderId: number; content: string }
  ) {
    const { channelId, senderId, content } = data;

    try {
      const roomClients = this.server.sockets.adapter.rooms.get(`channel-${channelId}`);

      const message = await this.channelService.sendMessageToChannel(
        channelId,
        senderId,
        content
      );


      const channelType = await this.channelService.getChannelType(channelId);

      const channel = await this.channelService.getChannelById(channelId);
      const ownerId = channel.owner.id;

    const ms = message;

      const socket = await this.server.to(`channel-${channelId}`).fetchSockets();

      const senderUser = await this.userService.findUserById(senderId);
      socket.map(async (element) => {
        const token = element.handshake.auth.token;
        const payload: any = jwtDecode.jwtDecode(token);
        const rec = await this.userService.findUserById(payload.id);
       
        const isBlocked = await this.channelService.IsBlocked(senderUser, rec);
        if (!isBlocked) {
          element.emit("newChannelMessage", {channelId,message});
        }
        else {
            const message = {
                id: ms.id,
                Content: "Hidden Message",
                Timestamp: ms.Timestamp,
                senderId: ms.senderId,
                username: ms.username,
                avatar: ms.avatar,
              }
          element.emit("newChannelMessage", {channelId, message})
        }

      })

      this.server.to(ownerId.toString()).emit("newChannelMessage", {channelId,message});
      }
     catch (error) {
      console.error("QError sending message to channel:", error);
    }
  }



  @SubscribeMessage("autojoined")
  async autoJoinChannel(client: Socket, data: { channelId: number; userId: number; }) {
    const { channelId, userId } = data;
    try {
    const user = await this.userService.findUserById(userId);
    if (!user)
      throw new HttpException("the user is not found", 404);

    const inchannel = await this.channelService.inChannel(userId, channelId);
    const channel = await this.channelService.getChannelById(channelId);
    if (inchannel == true && channel.owner.id != userId) {
      client.join(`channel-${channelId}`);
    }
  }
  catch(error){
    console.error("Error autojoining channel:", error);
  }
  }


  @SubscribeMessage("getChannelType")
  async handleGetChannelType(client: Socket, channelId: number) {
    try {
      const channelType = await this.channelService.getChannelType(channelId);
      const channel = await this.channelService.getChannelById(channelId);
      const ownerId = channel.owner.id;

      this.server
        .to(ownerId.toString())
        .emit("channelType", { channelId: channelId, channelType });

      this.server.emit("channelType", { channelId: channelId, channelType });

      this.server
        .to(`admin-${channelId}`)
        .emit("channelType", { channelId: channelId, channelType });
    } catch (error) {
      console.error("Error getting channel type:", error);
    }
  }



  @SubscribeMessage("checkChannelMembership")
  async handleCheckChannelMembership(
    client: Socket,
    data: { channelId: number; userId: number }
  ) {

    try {
    const status = await this.channelService.getUserChannelStatus(
      data.channelId,
      data.userId
    );
    client.emit("channelMembershipStatus", {
      channelId: data.channelId,
      ...status,
    });
  }
  catch(error){
    console.error("Error checking channel membership:", error);
  }
  }


  @SubscribeMessage("leaveChannel")
  async handleLeaveChannel(
    client: Socket,
    data: { channelId: number; userId: number }
  ) {
    try {
      await this.channelService.leaveChannel(data.channelId, data.userId);
      client.leave(`channel-${data.channelId}`);
      const channelType = await this.channelService.getChannelType(
        data.channelId
      );
      client.emit("channelType", { channelId: data.channelId, channelType });

      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.userId
      );
      client.emit("channelMembershipStatus", {
        channelId: data.channelId,
        ...status,
      });
      const members = await this.channelService.getChannelMembers(
        data.channelId
      );
      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server.to(ownerId.toString()).emit("channelMembers", members);
    } catch (error) {
      console.error("Error leaving channel:", error);
    }
  }

  @SubscribeMessage("ListOfFriend")
  async friendsList(
    client: Socket,
    data: { channelId: number; userid: number }
  ) {

    try{
    const friends = await this.userService.friends(data.userid);
  
    if(!friends)
    throw new HttpException("the user is not found", 404);

    const channel = await this.channelService.getChannelById(data.channelId);
    const obj = await Promise.all(
      friends.map(async (element) => {
        const inChannel = await this.channelService.inChannel(
          element.id,
          channel.id
        );
        return {
          username: element.username,
          image: element.Avatar,
          id: element.id,
          inChannel: inChannel,
        };
      })
    );

    this.server.to(data.userid.toString()).emit("FrindsListIs", obj);
    }
    catch(error){
      console.error("Error getting friends list:", error);
    }
  }

  @SubscribeMessage("addUsertoPrivateChannel")
  async addUsertoPrivateChannell(
    client: Socket,
    data: { channelId: number; userId: number; currentUserId: number;password?: string }
  ) {
    const { channelId, userId, password } = data;

    try {
      const adduser = await this.channelService.addUserToPrivateChannel(
        channelId,
        userId,
        data.currentUserId,
        password
      );
      const client2 = this.server.sockets.sockets.get(adduser);
      client2.join(`channel-${channelId}`);
      const message = await this.channelService.getChannelMessages(channelId);
      const channelType = await this.channelService.getChannelType(channelId);

      const userChannels = await this.channelService.getUserChannels(userId);
      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.userId
      );
      this.server.to(data.userId.toString()).emit("userChannels", userChannels);

      this.server.to(data.userId.toString()).emit("channelMembershipStatus", {
        channelId: data.channelId,
        ...status,
      });

      client.emit("channelType", { channelId, channelType });
      const channel = await this.channelService.getChannelById(channelId);
      const ownerId = channel.owner.id;
      const members = await this.channelService.getChannelMembers(channelId);
      const FrindsListIs = await this.friendsList(client, {
        channelId: data.channelId,
        userid: data.currentUserId,
      });

      this.server.to(ownerId.toString()).emit("channelMembers", members);

      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
    
      this.server
      .to(`adduserToPV-${channelId}`)
      .emit("newChannelMessage", {channelId, message});
      
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("leavePrivateChannel")
  async handleLeavePrivChannel(client: Socket,
    data: { channelId: number; userId: number ; currentUserId: number}) 
  {
    try {
    const remove = await this.channelService.removeUserFromPrivateChannel(
      data.channelId,
      data.userId,
      data.currentUserId
    );


    const client2 = this.server.sockets.sockets.get(remove);
    client2.join(`channel-${data.channelId}`);

    const channelType = await this.channelService.getChannelType(
      data.channelId
    );
    this.server.to(data.userId.toString()).emit("channelType", { channelId: data.channelId, channelType });

    const status = await this.channelService.getUserChannelStatus(
      data.channelId,
      data.userId

    );
    const userChannels = await this.channelService.getUserChannels(data.userId);

     await this.friendsList(client, {
      channelId: data.channelId,
      userid: data.currentUserId,
    }); 
    const channel = await this.channelService.getChannelById(data.channelId);
    const ownerId = channel.owner.id;
    this.server.to(data.userId.toString()).emit("channelMembershipStatus", {
      channelId: data.channelId,
      ...status,
    });
    
    this.server.to(data.userId.toString()).emit("userChannels", userChannels);

    const members = await this.channelService.getChannelMembers(
      data.channelId
      );
      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server.to(ownerId.toString()).emit("channelMembers", members);
    } catch (error) {
      console.error("Error leaving private channel:", error);
    }

  }

  @SubscribeMessage("getChannelMembers")
  async handleGetChannelMembers(client: Socket, channelId: number) {
    try {
      const members = await this.channelService.getChannelMembers(channelId);
      client.emit("channelMembers", members);
    } catch (error) {
      console.error("Error fetching channel members:", error);
    }
  }

  @SubscribeMessage("kickUserFromChannel")
  async handleKickUserFromChannel(
    client: Socket,
    data: { channelId: number; userId: number; requesterId: number }
  ) {
    try {

      await this.channelService.kickUserFromChannel(
        data.channelId,
        data.userId,
        data.requesterId
      );
      const messages = await this.channelService.getChannelMessages(
        data.channelId
      );
      client.leave(`channel-${data.channelId}`);

      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.requesterId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      this.server.to(ownerId.toString()).emit("channelMembers", members);

      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server
        .to(data.requesterId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      console.error("Error kicking user from channel:", error);
    }
  }

  @SubscribeMessage("ChanegePassword")
  async handleChanegePassword(
    client: Socket,
    data: { channelId: number; newPassword: string }
  ) {
    try {

      const rut = await this.channelService.changeChannelPassword(
        data.channelId,
        data.newPassword
      );
      client.emit("passupdated", true);
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("addpassword")
  async handleAddPassword(
    client: Socket,
    data: { channelId: number; newPassword: string; userId: number }
  ) {
    try {
      const addpass = await this.channelService.setChannelPassword(
        data.channelId,
        data.newPassword,
        data.userId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const userChannels = await this.channelService.getUserChannels(
        data.userId
      );
      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      const channelType = await this.channelService.getChannelType(
        data.channelId
      );

      this.server.emit("userChannels", userChannels);
      this.server
        .to(`channel-${data.channelId}`)
        .emit("userChannels", userChannels);

      this.server
        .to(ownerId.toString())
        .emit("channelType", { channelId: data.channelId, channelType });
      this.server
        .to(`channel-${data.channelId}`)
        .emit("channelType", { channelId: data.channelId, channelType });

      this.server.to(ownerId.toString()).emit("channelMembers", members);
      this.server
        .to(`admin-${data.channelId}`)
        .emit("channelType", { channelId: data.channelId, channelType });
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("removePass")
  async removeChannelPass(
    client: Socket,
    data: { channelId: number; userId: number }
  ) {
    try {
      const addpass = await this.channelService.removeChannelPassword(
        data.channelId,
        data.userId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const userChannels = await this.channelService.getUserChannels(
        data.userId
      );
      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      const channelType = await this.channelService.getChannelType(
        data.channelId
      );

      this.server.emit("userChannels", userChannels);
      this.server
        .to(`channel-${data.channelId}`)
        .emit("userChannels", userChannels);

      this.server
        .to(ownerId.toString())
        .emit("channelType", { channelId: data.channelId, channelType });
      this.server
        .to(`channel-${data.channelId}`)
        .emit("channelType", { channelId: data.channelId, channelType });

      this.server.to(ownerId.toString()).emit("channelMembers", members);
      this.server
        .to(`admin-${data.channelId}`)
        .emit("channelType", { channelId: data.channelId, channelType });
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("BanUser")
  async handlebanUser(
    client: Socket,
    data: { channelId: number; userId: number; targetUserId: number }
  ) {
    try {
      const Ban = await this.channelService.banUserFromChannel(
        data.channelId,
        data.userId,
        data.targetUserId
      );
      const client2 = this.server.sockets.sockets.get(Ban);
      client2.join(`buned-${data.channelId}`);
      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.targetUserId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      this.server.to(ownerId.toString()).emit("channelMembers", members);

      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);

      this.server
        .to(data.targetUserId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("UnBanUser")
  async handleUnbanUser(
    client: Socket,
    data: { channelId: number; userId: number; targetUserId: number }
  ) {
    try {
      const Ban = await this.channelService.unbanUserFromChannel(
        data.channelId,
        data.userId,
        data.targetUserId
      );
      client.leave(`buned-${data.channelId}`);
      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.targetUserId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      this.server.to(ownerId.toString()).emit("channelMembers", members);

      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server
        .to(data.targetUserId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("MuteUser")
  async handleMuteUser(
    client: Socket,
    data: { channelId: number; userId: number; targetUserId: number }
  ) {
    try {
      const Mute = await this.channelService.muteUserInChannel(
        data.channelId,
        data.userId,
        data.targetUserId
      );
      const client2 = this.server.sockets.sockets.get(Mute);
      client2.join(`muted-${data.channelId}`);
      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.targetUserId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      this.server.to(ownerId.toString()).emit("channelMembers", members);


      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server
        .to(data.targetUserId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("UnMuteUser")
  async handleUnMuteUser(
    client: Socket,
    data: { channelId: number; userId: number; targetUserId: number }
  ) {
    try {
      const UnMute = await this.channelService.unmuteUserInChannel(
        data.channelId,
        data.userId,
        data.targetUserId
      );

      client.leave(`muted-${data.channelId}`);
      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.targetUserId
      );

      const members = await this.channelService.getChannelMembers(
        data.channelId
      );

      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;
      this.server.to(ownerId.toString()).emit("channelMembers", members);


      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);
      this.server
        .to(data.targetUserId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      client.emit("is false ", false);
      throw error;
    }
  }

  @SubscribeMessage("setUserAsAdmin")
  async handleSetUserAsAdmin(
    client: Socket,
    data: { channelId: number; userId: number; requesterId: number }
  ) {

    try {
      const socket = await this.channelService.setUserAsAdmin(
        data.channelId,
        data.userId,
        data.requesterId
      );

      const client2 = this.server.sockets.sockets.get(socket);
      this.server
        .to(`channel-${data.channelId}`)
        .emit("userSetAsAdmin", (data.channelId, data.userId));

      client2.join(`admin-${data.channelId}`);
      
      const members = await this.channelService.getChannelMembers(
        data.channelId
      );
      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;

      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.requesterId
      );

      this.server.to(ownerId.toString()).emit("channelMembers", members);
      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);

      this.server
        .to(data.requesterId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      console.error("Error setting user as admin:", error.message);

      client.emit(
        "adminOperationFailed",
        (data.channelId, data.userId, error.message)
      );
    }
  }

  @SubscribeMessage("removeUserFromAdmin")
  async handleRemoveUserFromAdmin(
    client: Socket,
    data: { channelId: number; userId: number; requesterId: number }
  ) {

    try {
      await this.channelService.removeUserFromAdmin(
        data.channelId,
        data.userId,
        data.requesterId
      );

      this.server
        .to(`channel-${data.channelId}`)
        .emit("userRemovedFromAdmin", data.channelId, data.userId);

      client.leave(`admin-${data.channelId}`);
      const members = await this.channelService.getChannelMembers(
        data.channelId
      );
      const channel = await this.channelService.getChannelById(data.channelId);
      const ownerId = channel.owner.id;

      const status = await this.channelService.getUserChannelStatus(
        data.channelId,
        data.requesterId
      );

      this.server.to(ownerId.toString()).emit("channelMembers", members);
      this.server.to(`admin-${data.channelId}`).emit("channelMembers", members);

      this.server
        .to(data.requesterId.toString())
        .emit("channelMembershipStatus", {
          channelId: data.channelId,
          ...status,
        });
    } catch (error) {
      console.error("Error removing user from admin:", error.message);

      client.emit(
        "adminOperationFailed",
        data.channelId,
        data.userId,
        error.message
      );
    }
  }

}


