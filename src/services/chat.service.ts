import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import OpenAI from 'openai';
import { ConversationService } from './conversation.service';
import { Message, Model } from '../models/api/conversationApiModels';
import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import config from '../config/config';
import { createOpenAIMessagesFromMessages, formatDeepSeekResponse } from '../utils/utils';
import {chatPageSystemPrompt} from "../utils/prompts";
import { ModelsService } from './models.service';


@Injectable()
export class ChatService {
  constructor(private readonly conversationService: ConversationService,
              private readonly modelsService: ModelsService) {}

  async streamInference(prompt: string, memberId: string, conversationId?: string, modelId?: number): Promise<Observable<string>> {
    const model = await this.modelsService.getModelByIdOrGetDefault(memberId, modelId);
    if(conversationId){
      return this.streamInferenceWithConversation(prompt, memberId, conversationId, model);
    }else {
      return this.streamInferenceWithoutConversation(prompt, memberId, model);
    }
  }

  async streamInferenceWithConversation(prompt: string, memberId: string, conversationId: string, model:Model){
    //add the prompt to the messages table
    await this.conversationService.addMessageToConversation(memberId, conversationId, {messageText: prompt});
    //get all the messages in the conversation
    const conversation = await this.conversationService.getConversation(memberId, conversationId);
    if(!conversation){ throw new Error('Conversation not found'); }
    //convert messages into openai format.
    const openAiMessages = createOpenAIMessagesFromMessages(conversation.messages!);

    const handleOnText = (text: string) => {
      // console.log('handle on text got: ', text);
    };

    const handleResponseCompleted = async (completeResponse: string) => {
      console.log('handle response completed got: ', completeResponse);
      const formattedResponse = formatDeepSeekResponse(completeResponse);
      await this.conversationService.addMessageToConversation(config.getAiMemberId(), conversationId, {messageText: formattedResponse});
    }

    const observable = this.createInferenceObservable(openAiMessages, handleOnText, handleResponseCompleted, model);
    return observable;
  }

  async streamInferenceWithoutConversation(prompt: string, memberId: string, model: Model){
    const openAiMessages = createOpenAIMessagesFromMessages([{messageText: prompt, sentByMemberId: memberId, messageId: '', createdDate: ''}]);
    const observable = this.createInferenceObservable(openAiMessages, ()=>{}, ()=>{}, model);
    return observable;
  }

  createInferenceObservable(openAiMessages: ChatCompletionMessageParam[],
                            handleOnText: (text: string) => void,
                            handleResponseCompleted: (text: string) => void,
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
          await handleResponseCompleted(completeText);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

}
