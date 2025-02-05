import { Injectable } from '@nestjs/common';
import { MessagesRepository } from '../repositories/messages.repository';
import { CreateMessage, Message } from '../models/api/conversationApiModels';

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  /**
   * Gets a single message by its ID.
   * @param messageId - The unique identifier for the message.
   */
  async getMessage(messageId: string): Promise<Message | undefined> {
    return this.messagesRepository.getMessage(messageId);
  }

  /**
   * Gets all messages associated with a specific conversation.
   * @param conversationId - The unique identifier for the conversation.
   */
  async getMessagesForConversation(conversationId: string): Promise<Message[]> {
    return this.messagesRepository.getMessagesForConversation(conversationId);
  }

  /**
   * Creates a new message.
   * @param conversationId - unique id of the conversation
   * @param memberId - member who created the message
   * @param message - The message object to create.
   */
  async createMessageForConversation(conversationId: string, memberId: string, message: CreateMessage): Promise<Message> {
    return await this.messagesRepository.createMessageForConversation(conversationId, memberId, message);
  }

  /**
   * Updates an existing message by its ID.
   * @param messageId - The unique identifier for the message.
   * @param updatedMessage - The updated message object.
   */
  async updateMessage(messageId: string, updatedMessage: Message): Promise<Message> {
    return this.messagesRepository.updateMessage(messageId, updatedMessage);
  }

  /**
   * Deletes a message by its ID.
   * @param messageId - The unique identifier for the message.
   */
  async deleteMessage(messageId: string): Promise<void> {
    return this.messagesRepository.deleteMessage(messageId);
  }
}
