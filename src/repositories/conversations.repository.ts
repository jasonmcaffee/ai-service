import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { Conversation, CreateConversation } from '../models/api/conversationApiModels';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class ConversationsRepository {
  private sql: postgres.Sql;

  constructor() {
    this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
  }

  /**
   * Gets a single conversation by id and verifies ownership by memberId.
   * @param memberId - unique identifier for the member.
   * @param conversationId - unique identifier for the conversation.
   */
  async getConversation(memberId: string, conversationId: string) {
    const result = await this.sql<Conversation[]>`
        select * from conversation c
        where conversation_id = ${conversationId}
          and exists (
            select 1 from member_conversation mc
            where mc.member_id = ${memberId}
              and mc.conversation_id = c.conversation_id
          )
    `;
    if (!result.length) {
      return undefined;
    }
    return result[0];
  }

  /**
   * Creates a new conversation and associates it with a member in a transaction.
   * @param memberId - unique identifier for the member.
   * @param conversation - the conversation object to create.
   */
  async createConversation(memberId: string, conversation: CreateConversation) {
    return this.sql.begin(async (trx) => {
      const [createdConversation] = await trx<Conversation[]>`
        insert into conversation (conversation_id, conversation_name)
        values (${uuidv4()}, ${conversation.conversationName})
        returning *
      `;

      await trx`
        insert into member_conversation (member_id, conversation_id)
        values (${memberId}, ${createdConversation.conversationId})
      `;
      return createdConversation;
    });
  }

  /**
   * Updates an existing conversation and verifies ownership by memberId.
   * @param memberId - unique identifier for the member.
   * @param conversationId - unique identifier for the conversation.
   * @param conversation - the updated conversation object.
   */
  async updateConversation(memberId: string, conversationId: string, conversation: Conversation) {
    const ownershipCheck = await this.sql`
      select 1 from member_conversation mc
      where mc.member_id = ${memberId}
        and mc.conversation_id = ${conversationId}
    `;

    if (!ownershipCheck.length) {
      throw new Error('Member does not own this conversation');
    }

    const [updatedConversation] = await this.sql<Conversation[]>`
      update conversation
      set conversation_name = ${conversation.conversationName},
          created_date = ${conversation.createdDate}
      where conversation_id = ${conversationId}
      returning *
    `;

    return updatedConversation;
  }

  /**
   * Deletes a conversation and its association with a member in a transaction.
   * @param memberId - unique identifier for the member.
   * @param conversationId - unique identifier for the conversation.
   */
  async deleteConversation(memberId: string, conversationId: string) {
    return this.sql.begin(async (trx) => {
      const ownershipCheck = await trx`
        select 1 from member_conversation mc
        where mc.member_id = ${memberId}
          and mc.conversation_id = ${conversationId}
      `;

      if (!ownershipCheck.length) {
        throw new Error('Member does not own this conversation');
      }

      await trx`
        delete from member_conversation
        where member_id = ${memberId}
          and conversation_id = ${conversationId}
      `;

      await trx`
        delete from conversation
        where conversation_id = ${conversationId}
      `;
    });
  }

  /**
   * Gets all conversations associated with a member.
   * @param memberId - unique identifier for the member.
   */
  async getAllConversations(memberId: string) {
    return this.sql<Conversation[]>`
      select c.* from conversation c
      join member_conversation mc on mc.conversation_id = c.conversation_id
      where mc.member_id = ${memberId}
    `;
  }
}
