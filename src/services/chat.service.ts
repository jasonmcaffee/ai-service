import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import OpenAI from 'openai';
import { ConversationService } from './conversation.service';
import {Message, MessageContext, Model} from '../models/api/conversationApiModels';
// import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
  //clientId to abortcontroller map so we can stop.
  private abortControllers: Map<string, { controller: AbortController }> = new Map();

  constructor(private readonly conversationService: ConversationService,
              private readonly modelsService: ModelsService) {}

  async stop(memberId: string){
    const associatedAbortController = this.abortControllers.get(memberId);
    if(!associatedAbortController){
      return console.log(`no associated abort controller for member id: ${memberId}`);
    }
    console.log(`aborting controller`)
    associatedAbortController.controller.abort();
    this.abortControllers.delete(memberId);
  }
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
    //add datasources to conversation
    for (let datasourceContext of messageContext.datasources) {
      await this.conversationService.addDatasourceToConversation(memberId, parseInt(datasourceContext.id), conversationId);
    }

    const messageText = messageContext.originalText; //store the original text, unaltered.  alter before sending out.  // messageContext.textWithoutTags;
    //add the prompt to the messages table
    await this.conversationService.addMessageToConversation(memberId, conversationId, {messageText, role: 'user'});
    //get all the messages in the conversation
    const conversation = await this.conversationService.getConversation(memberId, conversationId, true);
    if(!conversation){ throw new Error('Conversation not found'); }

    //send user messages without <datasource> and <model> text.
    conversation.messages?.filter(m => m.sentByMemberId === memberId)
      .forEach(m => m.messageText = extractMessageContextFromMessage(m.messageText).textWithoutTags)

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

    const observable = this.createInferenceObservable(openAiMessages, handleOnText, handleResponseCompleted, model, memberId);
    return observable;
  }

  async streamInferenceWithoutConversation(prompt: string, memberId: string, model: Model, messageContext: MessageContext,){
    const userMessage = {messageText: prompt, sentByMemberId: memberId, messageId: '', createdDate: '', role: 'user'};
    let openAiMessages = createOpenAIMessagesFromMessages([userMessage]);
    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [...createOpenAIMessagesFromMessages([modelInitialMessage]), ...openAiMessages];
    }
    const observable = this.createInferenceObservable(openAiMessages, ()=>{}, ()=>{}, model, memberId);
    return observable;
  }

  createInferenceObservable(openAiMessages: ChatCompletionMessageParam[],
                            handleOnText: (text: string) => void,
                            handleResponseCompleted: (text: string, model: Model) => void,
                            model: Model,
                            memberId: string,
  ): Observable<string> {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL,});
    return new Observable((observer) => {
      let completeText = '';

      //allow a mechanism to cancel the request.
      const controller = new AbortController();
      const signal = controller.signal;
      this.abortControllers.set(memberId, {controller});

      openai.chat.completions
        .create({
          model: model.modelName, //'gpt-4',
          messages: [{role: 'system', content: chatPageSystemPrompt}, ...openAiMessages],
          stream: true,
        }, {signal})
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
          await handleResponseCompleted(completeText, model);
          this.abortControllers.delete(memberId);
          handleOnText(endSignal);
          observer.next(endSignal);
          observer.complete();
        })
        .catch((error) => {
          console.log(`openai error: `, error);
          this.abortControllers.delete(memberId);
          observer.error(error);
        });
    });
  }

}

//from chatgpt
//data: 429 You exceeded your current quota
