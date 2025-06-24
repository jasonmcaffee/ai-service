import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { Conversation, CreateMessage, Message, StatusTopicKeyValues } from '../models/api/conversationApiModels';
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
    if (result.length === 0) return undefined;

    const message = result[0];

    // Ensure JSON field is properly deserialized
    if (message.statusTopicsKeyValues) {
      message.statusTopicsKeyValues = JSON.parse(message.statusTopicsKeyValues as unknown as string);
    }

    return message;
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
          insert into message (message_id, sent_by_member_id, message_text, role, status_topics_key_values, tool_calls_json, image_url)
          values (${uuidv4()}, ${memberId}, ${message.messageText}, ${message.role}, ${message.statusTopicsKeyValues ? JSON.stringify(message.statusTopicsKeyValues) : null}, ${message.toolCallsJson ?? null}, ${message.imageUrl})
          returning *
      `;
      await trx`
        insert into conversation_message (conversation_id, message_id)
        values (${conversationId}, ${createdMessage.messageId})
      `;

      if(createdMessage.statusTopicsKeyValues){
        createdMessage.statusTopicsKeyValues = JSON.parse(createdMessage.statusTopicsKeyValues as unknown as string);
      }
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
          image_url = ${message.imageUrl},
          created_date = ${message.createdDate},
          role = ${message.role},
          status_topics_key_values = ${message.statusTopicsKeyValues ? JSON.stringify(message.statusTopicsKeyValues) : null}
      where message_id = ${messageId}
      returning *
    `;
    return updatedMessage;
  }

  async updateMessageStatusTopics(messageId: string, statusTopicsKeyValues?: StatusTopicKeyValues): Promise<Message> {
    const [updatedMessage] = await this.sql<Message[]>`
      update message
      set status_topics_key_values = ${statusTopicsKeyValues ? JSON.stringify(statusTopicsKeyValues) : null}
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
    const messages = await this.sql<Message[]>`
      select m.* from message m
      join conversation_message cm on cm.message_id = m.message_id
      where cm.conversation_id = ${conversationId}
    `;

    for(let message of messages){
      if(message.statusTopicsKeyValues){
        message.statusTopicsKeyValues = JSON.parse(message.statusTopicsKeyValues as unknown as string);
      }
    }
    return messages;
  }
}
