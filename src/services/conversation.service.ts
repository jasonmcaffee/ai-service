import { Injectable } from '@nestjs/common';
import {
  Conversation,
  CreateConversation,
  CreateMessage,
} from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesService } from './messages.service';
import config from '../config/config';
import { InferenceService } from './inference.service';
import { createOpenAIMessagesFromMessages, formatDeepSeekResponse } from '../utils/utils';
import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesService: MessagesService,
    private readonly inferenceService: InferenceService,
  ) {}

  async getConversation(memberId: string, conversationId: string, ): Promise<Conversation | undefined> {
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    const conversation = await this.conversationsRepository.getConversation(conversationId);
    if(!conversation){ return undefined; }
    const messages = await this.messagesService.getMessagesForConversation(conversation.conversationId);
    conversation.messages = messages || [];
    return conversation;
  }

  async createConversation(memberId: string, conversation: CreateConversation){
    return await this.conversationsRepository.createConversation(memberId, conversation);
  }

  async updateConversation(memberId: string, conversationId: string, conversation: Conversation){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    return await this.conversationsRepository.updateConversation(conversationId, conversation);
  }

  async deleteConversation(memberId: string, conversationId: string): Promise<void> {
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    await this.conversationsRepository.deleteConversation(memberId, conversationId);
  }

  async addMessageToConversation(memberId: string, conversationId: string, message: CreateMessage){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    return await this.messagesService.createMessageForConversation(conversationId, memberId, message);
  }

  async getConversationsForMember(memberId: string){
    return await this.conversationsRepository.getConversationsForMember(memberId);
  }

  async addDatasourceToConversation(memberId: string, datasourceId: number, conversationId: string){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    return this.conversationsRepository.addDatasourceToConversation(conversationId, datasourceId);
  }

  async ensureMemberOwnsConversation(memberId: string, conversationId: string){
    if(memberId == config.getAiMemberId()){ return; }
    return this.conversationsRepository.ensureMemberOwnsConversation(memberId, conversationId);
  }

  async haveAiNameTheConversation(memberId: string, conversationId: string){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    const prompt = `
      You are an expert at succinctly coming up with the title for a conversation, based on the messages in the conversation.
      Look at the previous messages that have been sent in this conversation, and come up with a title that is ten words or less.
      Do not respond with preamble, such as "Ok, here is the title", etc.  Only respond with the title.
    `;

    const conversation = await this.getConversation(memberId, conversationId);
    if(!conversation) { return new Error('Conversation not found'); }
    let openAiMessages = createOpenAIMessagesFromMessages(conversation.messages || []);
    const lastMessage = {role: 'user', content: prompt} as ChatCompletionMessageParam;
    openAiMessages = [...openAiMessages, lastMessage];
    const result = await this.inferenceService.nonStreamingInference(openAiMessages);
    console.log('have ai name the conversation result: ', result)
    const resultWithoutThinkTag = formatDeepSeekResponse(result);
    const updatedConversation = await this.updateConversation(memberId, conversationId, {
      conversationId: conversationId,
      createdDate: conversation.createdDate,
      conversationName: resultWithoutThinkTag
    });
    return updatedConversation;
  }

}
