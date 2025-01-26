import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { DatasourcesService } from '../services/datasource.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { Datasource, Document, CreateDatasource, CreateDocument } from '../models/api/conversationApiModels';

@ApiTags('Datasources')
@Controller('datasources')
export class DatasourcesController {
  constructor(private readonly datasourcesService: DatasourcesService) {}

  @ApiOperation({ summary: 'Create a new datasource' })
  @ApiBody({ type: CreateDatasource })
  @ApiResponse({ status: 201, description: 'The datasource has been created', type: Datasource })
  @Post()
  async createDatasource(@Body() createDatasource: CreateDatasource): Promise<Datasource> {
    const { name, datasourceTypeId, conversationId } = createDatasource;
    return await this.datasourcesService.createDatasource(name, datasourceTypeId, conversationId);
  }

  @ApiOperation({ summary: 'Create a new document' })
  @ApiBody({ type: CreateDocument })
  @ApiResponse({ status: 201, description: 'The document has been created', type: Document })
  @Post('documents')
  async createDocument(@Body() createDocument: CreateDocument): Promise<Document> {
    const { text, datasourceId} = createDocument;
    return await this.datasourcesService.createDocument(text, datasourceId);
  }

  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'documentId', type: 'number' })
  @ApiResponse({ status: 200, description: 'The document details', type: Document })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Get('documents/:documentId')
  async getDocumentById(@Param('documentId') documentId: number): Promise<Document | undefined> {
    return await this.datasourcesService.getDocumentById(documentId);
  }

  @ApiOperation({ summary: 'Get datasource by ID' })
  @ApiParam({ name: 'datasourceId', type: 'number' })
  @ApiResponse({ status: 200, description: 'The datasource details', type: Datasource })
  @ApiResponse({ status: 404, description: 'Datasource not found' })
  @Get(':datasourceId')
  async getDatasourceById(@Param('datasourceId') datasourceId: number): Promise<Datasource | undefined> {
    return await this.datasourcesService.getDatasourceById(datasourceId);
  }

  @ApiOperation({ summary: 'Get all documents for a datasource' })
  @ApiParam({ name: 'datasourceId', type: 'number' })
  @ApiResponse({ status: 200, description: 'List of documents for the datasource', type: [Document] })
  @Get(':datasourceId/documents')
  async getDocumentsForDatasource(@Param('datasourceId') datasourceId: number): Promise<Document[]> {
    return await this.datasourcesService.getDocumentsForDatasource(datasourceId);
  }

  @ApiOperation({ summary: 'Get all datasources for a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'List of datasources for the conversation', type: [Datasource] })
  @Get('conversation/:conversationId')
  async getDatasourcesForConversation(@Param('conversationId') conversationId: string): Promise<Datasource[]> {
    return await this.datasourcesService.getDatasourcesForConversation(conversationId);
  }

  @ApiOperation({ summary: 'Get all documents for a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'List of documents for the conversation', type: [Document] })
  @Get('conversation/:conversationId/documents')
  async getDocumentsForConversation(@Param('conversationId') conversationId: string): Promise<Document[]> {
    return await this.datasourcesService.getDocumentsForConversation(conversationId);
  }
}
