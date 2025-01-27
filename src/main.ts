import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ensureTablesExist } from './db/ensureTablesExist';
import { writeFileSync } from 'fs';
import { join } from 'path';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('AI API')
    .setDescription('API to manage to interact with AI')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Save the Swagger JSON specification to a file
  const swaggerPath = join(__dirname, "..", "src",  'openapi-spec.json');
  writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  await ensureTablesExist();

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
  // const api = new ConversationApi(new Configuration({basePath: 'http://localhost:3000'}));
  //
  // const response = await api.conversationControllerGetConversation( {conversationId: '2'});
  // console.log('response using client: ', response);
  // const chatApi = new ChatApiCustomStreaming(apiConfig);
  //
  // let completed = ''
  // const chatResult = await chatApi.customChatControllerStreamInferenceV2(
  //   {prompt: 'What is 2 + 2? Dont gabber.  Just provide the exact answer without thinking.  Response should be in markdown format.'},
  //   (text: string) => {
  //     console.log('got text: ', text);
  //   },
  //   (completeResponse: string) => {
  //     console.log('complete result: ', completeResponse);
  //   }
  //   );

}

bootstrap();


