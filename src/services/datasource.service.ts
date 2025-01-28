import { Injectable } from '@nestjs/common';
import { Datasource, Document, CreateDatasource, CreateDocument } from '../models/api/conversationApiModels';
import { DatasourcesRepository } from '../repositories/datasource.repository';

@Injectable()
export class DatasourcesService {
  constructor(
    private readonly datasourcesRepository: DatasourcesRepository,
  ) {}

  async createDatasource(name: string, datasourceTypeId: number, conversationId: string): Promise<Datasource> {
    return this.datasourcesRepository.createDatasource(name, datasourceTypeId, conversationId);
  }

  async createDocument(text: string, datasourceId: number): Promise<Document> {
    const metadata = {};
    const filePath = '';//TODO
    return this.datasourcesRepository.createDocument(text, datasourceId, metadata, filePath);
  }

  async getDocumentById(documentId: number): Promise<Document | undefined> {
    return this.datasourcesRepository.getDocumentById(documentId);
  }

  async getDatasourceById(datasourceId: number): Promise<Datasource | undefined> {
    console.log(`getting datasource id: ${datasourceId}`);
    return this.datasourcesRepository.getDatasourceById(datasourceId);
  }

  async getDocumentsForDatasource(datasourceId: number): Promise<Document[]> {
    console.log(`getting documents for datasource id: ${datasourceId}`);
    return this.datasourcesRepository.getDocumentsForDatasource(datasourceId);
  }

  async getDatasourcesForConversation(conversationId: string): Promise<Datasource[]> {
    return this.datasourcesRepository.getDatasourcesForConversation(conversationId);
  }

  async getDocumentsForConversation(conversationId: string): Promise<Document[]> {
    return this.datasourcesRepository.getDocumentsForConversation(conversationId);
  }
}
