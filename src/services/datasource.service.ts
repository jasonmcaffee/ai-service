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

  async createDocument(memberId: string, datasourceId: number, base64String: string, fileName: string): Promise<Document> {
    await this.ensureMemberOwnsDatasource(memberId, datasourceId);
    const metadata = {};
    console.log(`got base 64 string: `, base64String);
    const text = Buffer.from(base64String, 'base64').toString('utf-8');
    return this.datasourcesRepository.createDocument(text, datasourceId, metadata, fileName);
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

  async addDatasourceToConversation(datasourceId: number, conversationId: string){
    return this.datasourcesRepository.addDatasourceToConversation(datasourceId, conversationId);
  }

  async deleteDatasourceFromConversation(datasourceId: number, conversationId: string){
    return this.datasourcesRepository.deleteDatasourceFromConversation(datasourceId, conversationId);
  }

}
