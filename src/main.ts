import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ensureTablesExist } from './db/ensureTablesExist';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('AI API')
    .setDescription('API to manage to interact with AI')
    .setVersion('1.0')
    .build();

  // const document = SwaggerModule.createDocument(app, config);
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey, // Prevent naming ConversationControllerCreateConversation etc.  Just be createConversation
  });
  SwaggerModule.setup('api', app, document);

  // Save the Swagger JSON specification to a file
  const swaggerPath = join(__dirname, "..", "src",  'openapi-spec.json');
  writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  await ensureTablesExist();
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(process.env.PORT ?? 3000);
  try{
    await testClient();
  }catch(e){
    console.error('error fetching using client', e);
  }

}
import { ConversationApi } from './client/api-client/apis/ConversationApi';
import { Configuration } from './client/api-client/runtime';
import { ChatApi } from './client/api-client';
import { ChatApiCustomStreaming } from './client/api-client/apis/ChatApiCustomStreaming';

async function testClient(){
  const apiConfig = new Configuration({basePath: 'http://localhost:3000'});
  const api = new ConversationApi(new Configuration({basePath: 'http://localhost:3000'}));

  // works
  // const conversation = await api.createConversation( {conversationName: 'test 2'});
  // const addedMessage = await api.addMessage(conversation.conversationId, {messageText: 'hi message'});
  // console.log('added message', addedMessage);

  // const retrievedConversation = await api.getConversation("ff37fb6b-2211-4188-a266-b202ab791430");
  // console.log('retrieved conversation: ', retrievedConversation);

  // const retrievedConversations = await api.getConversationsForMember();
  // console.log('retrieved conversations: ', retrievedConversations);
  //works
  // const chatApi = new ChatApiCustomStreaming(apiConfig);

  // let completed = ''
  // const chatResult = await chatApi.customChatControllerStreamInferenceV2({
  //       prompt: 'What is 2 + 2?'
  //   },
  //   (text: string) => {
  //     console.log('got text: ', text);
  //   },
  //   (completeResponse: string) => {
  //     console.log('complete result: ', completeResponse);
  //   }
  //   );

}

bootstrap();


