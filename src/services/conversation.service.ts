import { Injectable } from '@nestjs/common';
import { Conversation, CreateConversation, CreateMessage, Message } from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesService } from './messages.service';
import config from '../config/config';
@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesService: MessagesService,
  ) {}

  async getConversation(memberId: string, conversationId: string, ): Promise<Conversation | undefined> {
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    const conversation = await this.conversationsRepository.getConversation(conversationId);
    if(!conversation){ return undefined; }
    const messages = await this.messagesService.getMessagesForConversation(conversation.conversationId);
    conversation.messages = messages || [];
    return conversation;
  }

  async createConversation(memberId: string, conversation: CreateConversation){
    return await this.conversationsRepository.createConversation(memberId, conversation);
  }

  async updateConversation(memberId: string, conversationId: string, conversation: Conversation){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    return await this.conversationsRepository.updateConversation(conversationId, conversation);
  }

  async deleteConversation(memberId: string, conversationId: string): Promise<void> {
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    await this.conversationsRepository.deleteConversation(memberId, conversationId);
  }

  async addMessageToConversation(memberId: string, conversationId: string, message: CreateMessage){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    return await this.messagesService.createMessageForConversation(conversationId, memberId, message);
  }

  async getConversationsForMember(memberId: string){
    return await this.conversationsRepository.getConversationsForMember(memberId);
  }

  async addDatasourceToConversation(memberId: string, datasourceId: number, conversationId: string){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    return this.conversationsRepository.addDatasourceToConversation(conversationId, datasourceId);
  }

  async ensureMemberOwnsConversation(memberId: string, conversationId: string){
    if(memberId == config.getAiMemberId()){ return; }
    return this.conversationsRepository.ensureMemberOwnsConversation(memberId, conversationId);
  }

}
