import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { Conversation } from '../models/api/conversationApiModels';

@Injectable()
export class ConversationsRepository{
  private sql: postgres.Sql;
  constructor() {
    this.sql = postgres(config.getDbConnectionString());
  }

  async getConversation(conversationId: string){
    const result = await this.sql<Conversation[]>`
        select * from conversation c 
        where conversation_id = ${conversationId}
    `;
    if(!result.length){
      return undefined;
    }
    return result[0];
  }

}
