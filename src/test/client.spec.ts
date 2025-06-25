import { Test, TestingModule } from '@nestjs/testing';
import {
  Configuration,
  ConversationApi,
  DatasourcesApi,
  Datasource,
  Document,
  ModelsApi,
  StreamInferenceRequest, StatusTopicKeyValuesResponse,
} from '../client/api-client';
import { AIServiceStreamingChat } from '../client/AIServiceStreamingChat';

describe('Client Tests', () => {
  const apiConfig = new Configuration({basePath: 'http://localhost:3000'});

  describe('Chat with SSE', () => {
    const aiServiceStreamingChat = new AIServiceStreamingChat(apiConfig);
    it('should chat', async ()=> {
      const request: StreamInferenceRequest = {
        prompt: 'hello',
        shouldSearchWeb: false, shouldRespondWithAudio: false, shouldUseAgentOfAgents: false, shouldUsePlanTool: false,
        textToSpeechSpeed: 1, temperature: 1, topP: 0.9, frequencyPenalty: 1, presencePenalty: 0,
      };
      const onTextReceivedCallback = (text: string) => {

      };
      const onResponseCompleteCallback = (text: string) => {

      };
      const onStatusUpdatesReceivedCallback = (s: StatusTopicKeyValuesResponse) => {

      };

      const onAudioReceived = async (audioBlob: Blob)=> {

      };
      const onAudioCompleteCallback = () => {

      };
      aiServiceStreamingChat.streamInferenceSSE(request, onTextReceivedCallback, onResponseCompleteCallback, onStatusUpdatesReceivedCallback, onAudioReceived, onAudioCompleteCallback);
    });


  });

  describe('Conversation', ()=>{
    const api = new ConversationApi(apiConfig);

    it('should create conversations', async () => {
      const conversationName = "Test Conversation 2";
      const createdConversation = await api.createConversation({conversationName});
      expect(createdConversation.conversationName).toBe(conversationName);

      const retrievedConversation = await api.getConversation(createdConversation.conversationId);
      expect(retrievedConversation.conversationName).toBe(conversationName);

      // await api.haveAiNameTheConversation(createdConversation.conversationId);
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
      const createdDocument = await api.createDocument(createdDatasource.id, {base64String: btoa(documentText), fileName: 'test'});
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

  describe('Model', ()=>{
    const api = new ModelsApi(apiConfig);
    it('should get model types', async ()=> {
      const modelTypesResult = await api.getModelTypes();
      expect(modelTypesResult.length >= 1).toBe(true);
    });

    it('should CRUD models', async ()=> {
      const apiKey = '1234';
      const modelName = 'test 2 abc';
      const modelTypeId = 1;
      const url = 'http://localhost:8080';
      const displayName = 'Jason Test';
      const isDefault = true;

      const createModelResponse = await api.createModel({
        apiKey, modelName, modelTypeId, url, displayName, isDefault, initialMessage: '', filePath: '', additionalLlamacppServerParams: null, contextSize: 5000, prependNoThinkTagToBeginningOfEachMessage: false,
      });

      expect(createModelResponse !== undefined).toBe(true);
      expect(createModelResponse.apiKey).toBe(apiKey);
      expect(createModelResponse.modelName).toBe(modelName);
      expect(createModelResponse.modelTypeId).toBe(modelTypeId);
      expect(createModelResponse.url).toBe(url);
      expect(createModelResponse.displayName).toBe(displayName);
      expect(createModelResponse.isDefault).toBe(isDefault);

      const allModelsForMember = await api.getAllModelsForMember();
      expect(allModelsForMember.length >= 1).toBe(true);
      const foundModel = allModelsForMember.find(m => m.id === createModelResponse.id);
      expect(foundModel !== undefined).toBe(true);
      expect(foundModel?.apiKey).toBe(apiKey);
      expect(foundModel?.modelName).toBe(modelName);
      expect(foundModel?.modelTypeId).toBe(modelTypeId);
      console.log(`found model url: ${foundModel?.url}`);
      expect(foundModel?.url).toBe(url);
      expect(foundModel?.displayName).toBe(displayName);
      expect(foundModel?.isDefault).toBe(isDefault);

      await api.deleteModel(createModelResponse.id);

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
