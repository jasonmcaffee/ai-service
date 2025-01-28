import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { DatasourcesService } from '../services/datasource.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { Datasource, Document, CreateDatasource, CreateDocument } from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';

@ApiTags('Datasources')
@Controller('datasources')
export class DatasourcesController {
  constructor(private readonly datasourcesService: DatasourcesService, private readonly authenticationService: AuthenticationService) {}

  @ApiOperation({ summary: 'Create a new datasource' })
  @ApiBody({ type: CreateDatasource })
  @ApiResponse({ status: 201, description: 'The datasource has been created', type: Datasource })
  @Post('datasource')
  async createDatasource(@Body() createDatasource: CreateDatasource): Promise<Datasource> {
    const memberId = this.authenticationService.getMemberId();
    const { name, datasourceTypeId} = createDatasource;
    return await this.datasourcesService.createDatasource(memberId, name, datasourceTypeId);
  }

  @ApiOperation({ summary: 'Create a new document' })
  @ApiBody({ type: CreateDocument })
  @ApiParam({ name: 'datasourceId', type: 'number' })
  @ApiResponse({ status: 201, description: 'The document has been created', type: Document })
  @Post('datasource/:datasourceId/document')
  async createDocument(@Body() createDocument: CreateDocument, @Param('datasourceId') datasourceId: number): Promise<Document> {
    const memberId = this.authenticationService.getMemberId();
    const { text} = createDocument;
    return await this.datasourcesService.createDocument(memberId, text, datasourceId);
  }

  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'documentId', type: 'number' })
  // @ApiParam({ name: 'datasourceId', type: 'number' })  not really needed.  might be good for verification
  @ApiResponse({ status: 200, description: 'The document details', type: Document })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Get('datasource/documents/:documentId')
  async getDocumentById(@Param('documentId') documentId: number): Promise<Document | undefined> {
    const memberId = this.authenticationService.getMemberId();
    return await this.datasourcesService.getDocumentById(memberId, documentId);
  }

  @ApiOperation({ summary: 'Get datasource by ID' })
  @ApiParam({ name: 'datasourceId', type: 'number' })
  @ApiResponse({ status: 200, description: 'The datasource details', type: Datasource })
  @ApiResponse({ status: 404, description: 'Datasource not found' })
  @Get('datasource/:datasourceId')
  async getDatasourceById(@Param('datasourceId') datasourceId: number): Promise<Datasource | undefined> {
    const memberId = this.authenticationService.getMemberId();
    return await this.datasourcesService.getDatasourceById(memberId, datasourceId);
  }

  @ApiOperation({ summary: 'Get all documents for a datasource' })
  @ApiParam({ name: 'datasourceId', type: 'number' })
  @ApiResponse({ status: 200, description: 'List of documents for the datasource', type: [Document] })
  @Get('datasource/:datasourceId/documents')
  async getDocumentsForDatasource(@Param('datasourceId') datasourceId: number): Promise<Document[]> {
    const memberId = this.authenticationService.getMemberId();
    return await this.datasourcesService.getDocumentsForDatasource(memberId, datasourceId);
  }

  @ApiOperation({ summary: 'Get all datasources for a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'List of datasources for the conversation', type: [Datasource] })
  @Get('conversation/:conversationId')
  async getDatasourcesForConversation(@Param('conversationId') conversationId: string): Promise<Datasource[]> {
    const memberId = this.authenticationService.getMemberId();
    return await this.datasourcesService.getDatasourcesForConversation(memberId, conversationId);
  }

  @ApiOperation({ summary: 'Get all documents for a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'List of documents for the conversation', type: [Document] })
  @Get('conversation/:conversationId/documents')
  async getDocumentsForConversation(@Param('conversationId') conversationId: string): Promise<Document[]> {
    const memberId = this.authenticationService.getMemberId();
    return await this.datasourcesService.getDocumentsForConversation(memberId, conversationId);
  }

  @ApiOperation({summary: 'get all datasources for a member'})
  @ApiResponse({ status: 200, description: 'List of datasources owned by the member', type: [Datasource] })
  @Get('member')
  async getAllDatasourcesForMember(){
    const memberId = this.authenticationService.getMemberId();
    return await this.datasourcesService.getAllDatasourcesForMember(memberId);
  }

  @ApiOperation({summary: 'deletes a datasource'})
  @ApiParam({name: 'datasourceId', type: 'number'})
  @ApiResponse({status: 201, description: 'indication if deleted successfully'})
  @Delete('datasource/:datasourceId')
  async deleteDatasource(@Param('datasourceId') datasourceId: number){
    const memberId = this.authenticationService.getMemberId();
    await this.datasourcesService.deleteDatasource(memberId, datasourceId);
  }
}
