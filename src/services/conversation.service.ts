import { Injectable } from '@nestjs/common';
import { Conversation, CreateConversation, CreateMessage, Message } from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesService } from './messages.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesService: MessagesService,
  ) {}

  async getConversation(memberId: string, conversationId: string, ): Promise<Conversation | undefined> {
    const conversation = await this.conversationsRepository.getConversation(memberId, conversationId);
    if(!conversation){ return undefined; }
    const messages = await this.messagesService.getMessagesForConversation(conversation.conversationId);
    conversation.messages = messages || [];
    return conversation;
  }

  async createConversation(memberId: string, conversation: CreateConversation){
    return await this.conversationsRepository.createConversation(memberId, conversation);
  }

  async updateConversation(memberId: string, conversationId: string, conversation: Conversation){
    return await this.conversationsRepository.updateConversation(memberId, conversationId, conversation);
  }

  async deleteConversation(memberId: string, conversationId: string): Promise<void> {
    await this.conversationsRepository.deleteConversation(memberId, conversationId);
  }

  async addMessageToConversation(memberId: string, conversationId: string, message: CreateMessage){
    return await this.messagesService.createMessageForConversation(conversationId, memberId, message);
  }

  async getConversationsForMember(memberId: string){
    return await this.conversationsRepository.getConversationsForMember(memberId);
  }

}
