import { Injectable } from '@nestjs/common';
import { Conversation } from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';

@Injectable()
export class ConversationService {
  constructor(private readonly conversationsRepository: ConversationsRepository) {}

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

}
