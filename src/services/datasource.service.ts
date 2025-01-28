import { Injectable } from '@nestjs/common';
import { Datasource, Document, CreateDatasource, CreateDocument } from '../models/api/conversationApiModels';
import { DatasourcesRepository } from '../repositories/datasource.repository';

@Injectable()
export class DatasourcesService {
  constructor(
    private readonly datasourcesRepository: DatasourcesRepository,
  ) {}

  async createDatasource(memberId: string, name: string, datasourceTypeId: number): Promise<Datasource> {
    return this.datasourcesRepository.createDatasource(memberId, name, datasourceTypeId);
  }

  async createDocument(memberId: string, text: string, datasourceId: number): Promise<Document> {
    await this.ensureMemberOwnsDatasource(memberId, datasourceId);
    const metadata = {};
    const filePath = '';//TODO
    return this.datasourcesRepository.createDocument(text, datasourceId, metadata, filePath);
  }

  async getDocumentById(memberId: string, documentId: number): Promise<Document | undefined> {
    await this.ensureMemberOwnsDocument(memberId, documentId);
    return this.datasourcesRepository.getDocumentById(documentId);
  }

  async getDatasourceById(memberId: string, datasourceId: number): Promise<Datasource | undefined> {
    console.log(`getting datasource id: ${datasourceId}`);
    await this.ensureMemberOwnsDatasource(memberId, datasourceId);
    return this.datasourcesRepository.getDatasourceById(datasourceId);
  }

  async getDocumentsForDatasource(memberId: string, datasourceId: number): Promise<Document[]> {
    console.log(`getting documents for datasource id: ${datasourceId}`);
    await this.ensureMemberOwnsDatasource(memberId, datasourceId);
    return this.datasourcesRepository.getDocumentsForDatasource(datasourceId);
  }

  async getDatasourcesForConversation(memberId: string, conversationId: string): Promise<Datasource[]> {
    return this.datasourcesRepository.getDatasourcesForConversation(conversationId);
  }

  async getDocumentsForConversation(memberId: string, conversationId: string): Promise<Document[]> {
    return this.datasourcesRepository.getDocumentsForConversation(conversationId);
  }

  async getAllDatasourcesForMember(memberId: string){
    return this.datasourcesRepository.getAllDatasourcesForMember(memberId);
  }

  async deleteDatasource(memberId: string, datasourceId: number){
    await this.ensureMemberOwnsDatasource(memberId, datasourceId);
    return this.datasourcesRepository.deleteDatasource(datasourceId);
  }

  async ensureMemberOwnsDatasource(memberId: string, datasourceId: number){
    return this.datasourcesRepository.ensureMemberOwnsDatasource(memberId, datasourceId);
  }

  async ensureMemberOwnsDocument(memberId: string, documentId: number){
    return this.datasourcesRepository.ensureMemberOwnsDocument(memberId, documentId);
  }
}
