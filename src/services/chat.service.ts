import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import OpenAI from 'openai';
import { ConversationService } from './conversation.service';
import {Message, MessageContext, Model} from '../models/api/conversationApiModels';
import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import config from '../config/config';
import {
  createOpenAIMessagesFromMessages,
  extractMessageContextFromMessage,
  formatDeepSeekResponse
} from '../utils/utils';
import {chatPageSystemPrompt} from "../utils/prompts";
import { ModelsService } from './models.service';


@Injectable()
export class ChatService {
  constructor(private readonly conversationService: ConversationService,
              private readonly modelsService: ModelsService) {}

  async streamInference(prompt: string, memberId: string, conversationId?: string, modelId?: string): Promise<Observable<string>> {
    const messageContext = extractMessageContextFromMessage(prompt);
    console.log(`streamInference messageContext: `, messageContext);
    if(messageContext.datasources.length > 0){
      //todo add datasource to conversation or to message
    }
    const model = await this.getModelToUseForMessage(memberId, messageContext, modelId);
    if(conversationId){
      return this.streamInferenceWithConversation(prompt, memberId, conversationId, model, messageContext);
    }else {
      return this.streamInferenceWithoutConversation(prompt, memberId, model, messageContext);
    }
  }

  async getModelToUseForMessage(memberId: string, messageContext: MessageContext, modelId?: string){
    const modelIdForMessage = messageContext.models.length > 0 ? messageContext.models[0].id : modelId;
    return this.modelsService.getModelByIdOrGetDefault(memberId, modelIdForMessage);
  }

  async streamInferenceWithConversation(prompt: string, memberId: string, conversationId: string, model:Model, messageContext: MessageContext,){
    const messageText = messageContext.textWithoutTags;
    //add the prompt to the messages table
    await this.conversationService.addMessageToConversation(memberId, conversationId, {messageText, role: 'user'});
    //get all the messages in the conversation
    const conversation = await this.conversationService.getConversation(memberId, conversationId);
    if(!conversation){ throw new Error('Conversation not found'); }

    let openAiMessages = createOpenAIMessagesFromMessages(conversation.messages!);
    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [...createOpenAIMessagesFromMessages([modelInitialMessage]), ...openAiMessages]
    }

    console.log(`sending messages: `, openAiMessages);

    const handleOnText = (text: string) => {
      // console.log('handle on text got: ', text);
    };

    const handleResponseCompleted = async (completeResponse: string, model: Model) => {
      console.log('handle response completed got: ', completeResponse);
      const formattedResponse = formatDeepSeekResponse(completeResponse);
      await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText: formattedResponse, role: 'system'}, false);
    }

    const observable = this.createInferenceObservable(openAiMessages, handleOnText, handleResponseCompleted, model);
    return observable;
  }

  async streamInferenceWithoutConversation(prompt: string, memberId: string, model: Model, messageContext: MessageContext,){
    const userMessage = {messageText: prompt, sentByMemberId: memberId, messageId: '', createdDate: '', role: 'user'};
    let openAiMessages = createOpenAIMessagesFromMessages([userMessage]);
    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [...createOpenAIMessagesFromMessages([modelInitialMessage]), ...openAiMessages];
    }
    const observable = this.createInferenceObservable(openAiMessages, ()=>{}, ()=>{}, model);
    return observable;
  }

  createInferenceObservable(openAiMessages: ChatCompletionMessageParam[],
                            handleOnText: (text: string) => void,
                            handleResponseCompleted: (text: string, model: Model) => void,
                            model: Model,
  ): Observable<string> {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL,});
    return new Observable((observer) => {
      let completeText = '';
      openai.chat.completions
        .create({
          model: 'gpt-4',
          messages: [{role: 'system', content: chatPageSystemPrompt}, ...openAiMessages],
          stream: true,
        })
        .then(async (stream) => {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const text = JSON.stringify({ text: content });
              completeText += content;
              await handleOnText(content);
              observer.next(text);
            }
          }
          const endSignal = JSON.stringify({ end: 'true' });
          handleOnText(endSignal);
          observer.next(endSignal);
          await handleResponseCompleted(completeText, model);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

}
