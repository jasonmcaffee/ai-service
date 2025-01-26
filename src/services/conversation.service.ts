import { Injectable } from '@nestjs/common';
import { Conversation } from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';

@Injectable()
export class ConversationService {
  constructor(private readonly conversationsRepository: ConversationsRepository) {}

  async getConversation(conversationId: string) {
    // const c = new Conversation();
    // c.conversationId = conversationId;
    // c.conversationName = '';
    // c.createdDate = Date.now().toString();
    // // c.messages = [];
    // return c;
    return this.conversationsRepository.getConversation(conversationId);
  }
}
