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
    const conversation = await this.conversationsRepository.getConversation(memberId, conversationId);
    if(!conversation){ return undefined; }
    const messages = await this.messagesService.getMessagesForConversation(conversation.conversationId);
    conversation.messages = messages;
    return conversation;
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
    await this.messagesService.createMessageForConversation(conversationId, message);
  }

}
