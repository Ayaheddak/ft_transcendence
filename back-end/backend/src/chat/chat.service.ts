import { Injectable } from "@nestjs/common";
import { Message } from "src/entities/Message.entity";
import { User } from "src/entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { Equal, Repository } from "typeorm";
import { Chat } from "src/entities/Chat.entity";
import { Channel } from "src/entities/Channel.entity";
import { Channel_Membership } from "src/entities/Channel_Membership.entity";
import { Friendship } from "src/entities/Friendship.entity";
import { UserService } from "src/user/user.service";
import { BlockedList } from "src/entities/BlockedList.entity";

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Chat)
    private readonly directMessageRepository: Repository<Chat>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(Channel_Membership)
    private readonly Channel_MembershipRepository: Repository<Channel_Membership>,
    @InjectRepository(BlockedList)
    private readonly blockedListRepository: Repository<BlockedList>,
    private readonly userService: UserService

    // @InjectRepository(Friendship)
    // private readonly friendshipRepository: Repository<Friendship>
  ) {}

  async sendMessage(
    chatId: number,
    Content: string,
    sender: User
  ): Promise<Message> {
    const chat = await this.directMessageRepository.findOne({
      where: { id: chatId },
      relations: ["sender", "receiver"],
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID ${chatId} not found`);
    }

    // const receiver = chat.sender.id === sender.id ? chat.receiver : chat.sender;
    const receiver = chat.sender.id === sender.id ? chat.receiver : chat.sender;
    const friend = await this.userService.friends(sender.id);
    const friendShip = friend.find((fr) => fr.id === receiver.id);

    if (!friendShip) {
      throw new Error("User is not your friend");
    }

    const newMessage = new Message();
    newMessage.chatid = chat;
    newMessage.SenderUserID = sender;
    newMessage.ReceiverUserID = receiver;
    newMessage.Content = Content;
    newMessage.Timestamp = new Date().toISOString();


    return await this.messageRepository.save(newMessage);
  }

  async IsBlocked(sender: User, receiver: User): Promise<boolean> {
    const blockcheck = await this.blockedListRepository.findOne({
      where: [
        {
          Blocker: Equal(sender.id),
          BlockedUser: Equal(receiver.id),
        },
        {
          Blocker: Equal(receiver.id),
          BlockedUser: Equal(sender.id),
        },
      ],
    });
    return !!blockcheck;
  }

  async listChatsForUser(userId: number): Promise<Chat[]> {
    return await this.directMessageRepository.find({
      where: [{ sender: { id: userId } }, { receiver: { id: userId } }],
    });
  }

  async getMessages(chatId: number): Promise<Message[]> {
    const chat = await this.directMessageRepository.findOne({
      where: { id: chatId },
      relations: ["messageid"],
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID ${chatId} not found`);
    }
    return chat.messageid;
  }

  async getLastMessage(chatId: number, sender: User): Promise<Message> {
    {
      const chat = await this.directMessageRepository.findOne({
        where: { id: chatId, sender: sender },
        relations: ["messageid"],
      });

      const mesaage = await this.messageRepository.find({
        where: { chatid: chat },
        relations: ["SenderUserID", "ReceiverUserID", "chatid"],
      });

      return mesaage[mesaage.length - 1];
    }
  }

  async getMessagesForChat(chatId: number): Promise<any> {
    const chat = await this.directMessageRepository.findOne({
      where: { id: chatId },
      relations: [
        "messageid",
        "messageid.SenderUserID",
        "messageid.ReceiverUserID",
        "sender",
        "receiver",
      ],
    });

    if (chat) {
      return {
        id: chat.id,
        messages: chat.messageid
          .sort((a, b) => a.id - b.id) // Sort messages by id
          .map((message) => ({
            id: message.id,
            Content: message.Content,
            Timestamp: message.Timestamp,
            SenderUserID: message.SenderUserID,
            ReceiverUserID: message.ReceiverUserID,
          })),
        senderUsername: chat.sender.username,
        senderAvatar: chat.sender.Avatar,
        chatSenderId: chat.sender.id,
        chatReceiverId: chat.receiver.id,
        receiverUsername: chat.receiver.username,
        receiverAvatar: chat.receiver.Avatar,
      };
    }

    return { messages: [] };
  }

  async getLatestMessagesForAllChats(userId: number): Promise<any[]> {
    const chats = await this.directMessageRepository.find({
      where: [{ sender: { id: userId } }, { receiver: { id: userId } }],
      relations: ["messageid", "sender", "receiver"],
    });

    return chats
      .filter((chat) => chat.messageid && chat.messageid.length > 0)
      .map((chat) => {
        const lastMessage = chat.messageid[chat.messageid.length - 1];
        const receiveravatar = chat.receiver.Avatar;
        const senderavatar = chat.sender.Avatar;
        const senderflag = chat.sender.id;
        const receiverflag = chat.receiver.id;

        return {
          id: chat.id,
          name:
            chat.receiver.id === userId
              ? chat.sender.username
              : chat.receiver.username,
          lastMessage: lastMessage,
          receiveravatar: receiveravatar,
          senderavatar: senderavatar,
          senderflag: senderflag,
          receiverflag: receiverflag,
        };
      });
  }

  async getChatsByUserId(userId: number): Promise<Chat[]> {
    return await this.directMessageRepository.find({
      where: { sender: { id: userId } },
      relations: ["messageid", "sender", "receiver"],
    });
  }

  async findOrCreateChat(
    currentUser: User,
    targetUsername: string
  ): Promise<Chat> {
    const targetUser = await this.userRepository.findOne({
      where: { username: targetUsername },
    });

    if (currentUser.username === targetUsername) {
      throw new Error("Cannot create a chat with yourself.");
    }

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    const friend = await this.userService.friends(currentUser.id);
    if(!friend){
      throw new Error("You can only create a chat with friends");
    }
    const friendShip = friend.find((fr) => fr.id === targetUser.id);

    if (!friendShip) {
      throw new Error("You can only create a chat with friends");
    }

    let chat = await this.directMessageRepository.findOne({
      where: [
        { sender: currentUser, receiver: targetUser },
        { sender: targetUser, receiver: currentUser },
      ],
    });

    if (!chat) {
      chat = new Chat();
      chat.sender = currentUser;
      chat.receiver = targetUser;
      chat.DateStarted = new Date().toISOString();
      await this.directMessageRepository.save(chat);
    }

    return chat;
  }
}
