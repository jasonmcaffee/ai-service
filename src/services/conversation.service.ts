import { Injectable } from '@nestjs/common';
import { Conversation, Message } from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesService } from './messages.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesService: MessagesService,
  ) {}

  async getConversation(memberId: string, conversationId: string, ): Promise<Conversation | undefined> {
    return this.conversationsRepository.getConversation(memberId, conversationId);
  }

  async createConversation(memberId: string, conversation: Conversation): Promise<void> {
    await this.conversationsRepository.createConversation(memberId, conversation);
  }

  async updateConversation(memberId: string, conversationId: string, conversation: Conversation): Promise<void> {
    await this.conversationsRepository.updateConversation(memberId, conversationId, conversation);
  }

  async deleteConversation(memberId: string, conversationId: string): Promise<void> {
    await this.conversationsRepository.deleteConversation(memberId, conversationId);
  }

  async addMessageToConversation(memberId: string, conversationId: string, message: Message){
    await this.messagesService.createMessage(conversationId, message);
  }

}
