import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { Datasource, CreateDatasource, Document, CreateDocument } from '../models/api/conversationApiModels';

@Injectable()
export class DatasourcesRepository {
  private sql: postgres.Sql;

  constructor() {
    this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
  }

  /**
   * Creates a new datasource and associates it with a given datasource type.
   * @param name - The name of the datasource.
   * @param datasourceTypeId - The ID of the datasource type.
   * @param memberId
   */
  async createDatasource(memberId: string, name: string, datasourceTypeId: number): Promise<Datasource> {
    return this.sql.begin(async (trx) => {
      const result = await trx<Datasource[]>`
        INSERT INTO datasource (name, datasource_type_id)
        VALUES (${name}, ${datasourceTypeId})
        RETURNING *;
      `;

      await trx`
        INSERT INTO member_datasource (member_id, datasource_id)
        VALUES (${memberId}, ${result[0].id});
      `;
      return result[0];
    });
  }

  async ensureMemberOwnsDatasource(memberId: string, datasourceId: number){
    const ownershipCheck = await this.sql`
        select 1 from member_datasource md
        where md.member_id = ${memberId}
          and md.datasource_id = ${datasourceId}
      `;

    if(!ownershipCheck.length){
      throw new Error('Not found');
    }
  }

  async ensureMemberOwnsDocument(memberId: string, documentId: number){
    const ownershipCheck = await this.sql`
        select 1 from member_datasource md 
        join datasource_documents dd on dd.document_id = ${documentId}
        where md.member_id = ${memberId}
    `;

    if(!ownershipCheck.length){
      throw new Error('Not found');
    }
  }

  /**
   * Creates a new document.
   * @param text - The text of the document.
   * @param datasourceId
   * @param metadata - The metadata in JSONB format.
   * @param filePath - The file path of the document.
   */
  async createDocument(text: string, datasourceId: number, metadata: object, filePath: string) {
    return this.sql.begin(async (trx) => {
      // todo: metadata as jsonb.
      const result = await trx<Document[]>`
        INSERT INTO document (text, metadata, file_path)
        VALUES (${text}, ${null}, ${filePath})
        RETURNING *;
      `;

      await trx`
        INSERT INTO datasource_documents (datasource_id, document_id)
        VALUES (${datasourceId}, ${result[0].id});
      `;
      return result[0];
    });

  }

  /**
   * Retrieves a document by its ID.
   * @param documentId - The ID of the document.
   */
  async getDocumentById( documentId: number): Promise<Document | undefined> {
    const result = await this.sql<Document[]>`
      SELECT * FROM document
      WHERE id = ${documentId};
    `;
    return result.length ? result[0] : undefined;
  }

  /**
   * Retrieves a datasource by its ID.
   * @param datasourceId - The ID of the datasource.
   */
  async getDatasourceById(datasourceId: number): Promise<Datasource | undefined> {
    const result = await this.sql<Datasource[]>`
      SELECT * FROM datasource
      WHERE id = ${datasourceId};
    `;
    return result.length ? result[0] : undefined;
  }

  /**
   * Retrieves all documents for a given datasource.
   * @param datasourceId - The ID of the datasource.
   */
  async getDocumentsForDatasource(datasourceId: number): Promise<Document[]> {
    const result = await this.sql<Document[]>`
      SELECT d.*
      FROM document d
      JOIN datasource_documents dd ON d.id = dd.document_id
      WHERE dd.datasource_id = ${datasourceId};
  `;
    return result;
  }

  /**
   * Retrieves all datasources for a given conversation.
   * Datasource will have a date_added_to_conversation entry which is useful for sorting messages and datasources by date, so they're given to the llm in order.
   * @param conversationId - The ID of the conversation.
   */
  async getDatasourcesForConversation(conversationId: string): Promise<Datasource[]> {
    const result = await this.sql<Datasource[]>`
      SELECT ds.*, cd.created_date AS date_added_to_conversation
      FROM datasource ds
      JOIN conversation_datasource cd ON ds.id = cd.datasource_id
      WHERE cd.conversation_id = ${conversationId};
  `;
    return result;
  }


  /**
   * Retrieves all documents for a given conversation by fetching the associated datasources and their documents.
   * @param conversationId - The ID of the conversation.
   */
  async getDocumentsForConversation(conversationId: string): Promise<Document[]> {
    const result = await this.sql<Document[]>`
    SELECT d.*
    FROM document d
    JOIN datasource_documents dd ON d.id = dd.document_id
    JOIN conversation_datasource cd ON dd.datasource_id = cd.datasource_id
    WHERE cd.conversation_id = ${conversationId};
  `;
    return result;
  }

  async getAllDatasourcesForMember(memberId: string){
    const result = await this.sql<Datasource[]>`
        SELECT d.* 
        FROM datasource d 
        JOIN member_datasource md on md.datasource_id = d.id
        where md.member_id = ${memberId}
    `;
    return result;
  }

  async deleteDatasource(datasourceId: number){
    return this.sql.begin(async (trx) => {
      await trx`delete from member_datasource where datasource_id = ${datasourceId}`;
      await trx`delete from datasource_documents where datasource_id = ${datasourceId}`;
      await trx`delete from conversation_datasource where datasource_id = ${datasourceId}`;
      await trx`delete from datasource where id = ${datasourceId}`;
    });
  }

  async addDatasourceToConversation(datasourceId: number, conversationId: string){
    return this.sql`
        insert into conversation_datasource (conversation_id, datasource_id) VALUES (${conversationId}, ${datasourceId})
    `;
  }

  async deleteDatasourceFromConversation(datasourceId: number, conversationId: string){
    return this.sql`
        delete from conversation_datasource where datasource_id=${datasourceId} and conversation_id=${conversationId}
    `;
  }

}
