import { Test, TestingModule } from '@nestjs/testing';
import { Configuration, ConversationApi, DatasourcesApi, Datasource, Document } from '../client/api-client';

describe('Client Tests', () => {
  const apiConfig = new Configuration({basePath: 'http://localhost:3000'});

  describe('Conversation', ()=>{
    const api = new ConversationApi(apiConfig);

    it('should create conversations', async () => {
      const conversationName = "Test Conversation";
      const createdConversation = await api.createConversation({conversationName});
      expect(createdConversation.conversationName).toBe(conversationName);

      const retrievedConversation = await api.getConversation(createdConversation.conversationId);
      expect(retrievedConversation.conversationName).toBe(conversationName);

      await api.deleteConversation(createdConversation.conversationId);
    });

  });

  describe('Datasource', ()=>{
    const api = new DatasourcesApi(apiConfig);
    it('should create datasources', async () => {
      const datasourceTypeId = 1;
      const datasourceName = "Test Datasource";
      const createdDatasource = await api.createDatasource({datasourceTypeId, name: datasourceName});
      expect(createdDatasource.name).toBe(datasourceName);

      const documentText = "Hello this is a story";
      const createdDocument = await api.createDocument(createdDatasource.id, {text: documentText});
      expect(createdDocument.text).toBe(documentText);

      const retrievedDocument = await api.getDocumentById(createdDocument.id);
      expect(retrievedDocument.text).toBe(documentText);

      const retrievedDocuments = await api.getDocumentsForDatasource(createdDatasource.id);
      expect(retrievedDocuments.length).toBe(1);
      expect(retrievedDocuments[0].text).toBe(documentText);

      // await api.deleteDocument TODO

      await api.deleteDatasource(createdDatasource.id);
    });
  });
});

//   let appController: AppController;
//
//   beforeEach(async () => {
//     const app: TestingModule = await Test.createTestingModule({
//       controllers: [AppController],
//       providers: [AppService],
//     }).compile();
//
//     appController = app.get<AppController>(AppController);
//   });
//
//   describe('root', () => {
//     it('should return "Hello World!"', () => {
//       expect(appController.getHello()).toBe('Hello World!');
//     });
//   });
// });
// import { Test, TestingModule } from '@nestjs/testing';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
//
// describe('AppController', () => {
//   let appController: AppController;
//
//   beforeEach(async () => {
//     const app: TestingModule = await Test.createTestingModule({
//       controllers: [AppController],
//       providers: [AppService],
//     }).compile();
//
//     appController = app.get<AppController>(AppController);
//   });
//
//   describe('root', () => {
//     it('should return "Hello World!"', () => {
//       expect(appController.getHello()).toBe('Hello World!');
//     });
//   });
// });
