import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { Conversation, CreateMessage, Message } from '../models/api/conversationApiModels';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class MessagesRepository {
  private sql: postgres.Sql;

  constructor() {
    this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
  }

  /**
   * Gets a single message by id.
   * @param messageId - unique identifier for the message.
   */
  async getMessage(messageId: string): Promise<Message | undefined> {
    const result = await this.sql<Message[]>`
        select * from message m
        where message_id = ${messageId}
    `;
    return result.length ? result[0] : undefined;
  }

  /**
   * Creates a new message.
   * @param conversationId - unique id of the conversation
   * @param memberId - member id who sent the message
   * @param message - the message object to create.
   */
  async createMessageForConversation(conversationId: string, memberId: string, message: CreateMessage): Promise<Message> {
    return await this.sql.begin(async (trx) => {
      const [createdMessage] = await trx<Message[]>`
          insert into message (message_id, sent_by_member_id, message_text, role)
          values (${uuidv4()}, ${memberId}, ${message.messageText}, ${message.role})
          returning *
      `;
      await trx`
        insert into conversation_message (conversation_id, message_id)
        values (${conversationId}, ${createdMessage.messageId})
      `;
      return createdMessage;
    });

  }

  /**
   * THIS PROBABLY ISNT NEEDED
   * Updates an existing message.
   * @param messageId - unique identifier for the message.
   * @param message - the updated message object.
   */
  async updateMessage(messageId: string, message: Message): Promise<Message> {
    const [updatedMessage] = await this.sql<Message[]>`
      update message
      set sent_by_member_id = ${message.sentByMemberId},
          message_text = ${message.messageText},
          created_date = ${message.createdDate},
          role = ${message.role}
      where message_id = ${messageId}
      returning *
    `;
    return updatedMessage;
  }

  /**
   * Deletes a message by id.
   * @param messageId - unique identifier for the message.
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.sql`
      delete from message
      where message_id = ${messageId}
    `;
  }

  /**
   * Gets all messages for a specific conversation.
   * @param conversationId - unique identifier for the conversation.
   */
  async getMessagesForConversation(conversationId: string): Promise<Message[]> {
    return this.sql<Message[]>`
      select m.* from message m
      join conversation_message cm on cm.message_id = m.message_id
      where cm.conversation_id = ${conversationId}
    `;
  }
}
