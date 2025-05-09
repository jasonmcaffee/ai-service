import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import {Conversation, CreateConversation, Suggestion} from '../models/api/conversationApiModels';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class ConversationsRepository {
  private sql: postgres.Sql;

  constructor() {
    this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
  }

  /**
   * Gets a single conversation by id
   * @param conversationId - unique identifier for the conversation.
   */
  async getConversation(conversationId: string) {
    const result = await this.sql<Conversation[]>`
        select * from conversation c
        where conversation_id = ${conversationId}
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
   * @param conversationId - unique identifier for the conversation.
   * @param conversation - the updated conversation object.
   */
  async updateConversation(conversationId: string, conversation: Conversation) {
    const [updatedConversation] = await this.sql<Conversation[]>`
      update conversation
      set conversation_name = ${conversation.conversationName}
      where conversation_id = ${conversationId}
      returning *
    `;

    return updatedConversation;
  }

  async addDatasourceToConversation(conversationId: string, datasourceId: number){

    return this.sql`
        INSERT INTO conversation_datasource(conversation_id, datasource_id) 
        VALUES (${conversationId}, ${datasourceId});
    `;
  }

  async doesDatasourceExistInConversation(conversationId: string, datasourceId: number){
      const result = await this.sql<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM conversation_datasource WHERE conversation_id = ${conversationId} AND datasource_id = ${datasourceId}
          ) AS exists
        `;
      return result[0]?.exists;
  }

  async ensureMemberOwnsConversation(memberId: string, conversationId: string){
    const ownershipCheck = await this.sql`
        select 1 from member_conversation mc
        where mc.member_id = ${memberId}
          and mc.conversation_id = ${conversationId}
      `;

    if (!ownershipCheck.length) {
      throw new Error('Member does not own this conversation');
    }
  }

  /**
   * Deletes a conversation and its association with a member in a transaction.
   * @param memberId - unique identifier for the member.
   * @param conversationId - unique identifier for the conversation.
   */
  async deleteConversation(memberId: string, conversationId: string) {
    await this.ensureMemberOwnsConversation(memberId, conversationId);

    return this.sql.begin(async (trx) => {
      await trx`
        delete from conversation_datasource
        where conversation_id = ${conversationId}
      `;
      await trx`
        delete from member_conversation
        where member_id = ${memberId}
          and conversation_id = ${conversationId}
      `;
      await trx`
        delete from conversation_message 
        where conversation_id = ${conversationId}
      `;
      await trx`
        delete from conversation
        where conversation_id = ${conversationId}
      `;
    });
  }

  /**
   * Gets all conversations associated with a member.
   * Messages are not included intentionally. (Call get conversation to get messages)
   * @param memberId - unique identifier for the member.
   */
  async getConversationsForMember(memberId: string) {
    return this.sql<Conversation[]>`
      select c.* from conversation c
      join member_conversation mc on mc.conversation_id = c.conversation_id
      where mc.member_id = ${memberId}
      order by c.created_date desc
    `;
  }

  async getAutoCompleteSuggestions(memberId: string, searchText: string) {
    return this.sql<Suggestion[]>`
      SELECT m.id, m.display_name AS name, 'model' AS type
      FROM model m
      WHERE m.member_id = ${memberId}
        AND m.display_name ILIKE ${'%' + searchText + '%'}
      
      UNION ALL
      
      SELECT d.id::text, d.name, 'datasource' AS type
      FROM datasource d
      JOIN member_datasource md ON md.datasource_id = d.id
      WHERE md.member_id = ${memberId}
        AND d.name ILIKE ${'%' + searchText + '%'}
      
      UNION ALL 
      
      SELECT mp.id, mp.prompt_name, 'prompt' AS type
      FROM member_prompt mp
      where mp.member_id = ${memberId}
      and mp.prompt_name ILIKE ${'%' + searchText + '%'}
    `;
  }

}
