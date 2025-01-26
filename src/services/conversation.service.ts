import { Injectable } from '@nestjs/common';
import { Conversation } from '../models/api/conversationApiModels';

@Injectable()
export class ConversationService {
  getConversation(conversationId: string) {
    const c = new Conversation();
    c.conversationId = conversationId;
    c.conversationName = '';
    c.createdDate = Date.now().toString();
    // c.messages = [];
    return c;
  }
}
