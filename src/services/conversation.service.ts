import { Injectable } from '@nestjs/common';
import {
  Conversation,
  CreateConversation,
  CreateMessage, Datasource, Document, Message, StatusTopicKeyValues, Suggestion,
} from '../models/api/conversationApiModels';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesService } from './messages.service';
import config from '../config/config';
import { InferenceService } from './inference.service';
import { createOpenAIMessagesFromMessages, removeThinkTagFromLLMResponse } from '../utils/utils';
// import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { DatasourcesService } from './datasource.service';
import { documentPrompt, nameConversationPrompt } from '../utils/prompts';
import { StatusTopics } from '../models/api/StatusTopics';
@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesService: MessagesService,
    private readonly inferenceService: InferenceService,
    private readonly datasourcesService: DatasourcesService,
  ) {}

  /**
   * Retrieves all messages and datasources for a conversation.
   * Note: datasource documents are added to messages when added to the conversation.
   * @param memberId
   * @param conversationId
   * @param includeDocumentsAsMessages - useful for chat interactions, where we want to send docs as messages.  not useful when painting the screen with messages, as we don't want to show these.
   */
  async getConversation(memberId: string, conversationId: string, includeDocumentsAsMessages = false): Promise<Conversation | undefined> {
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    const conversation = await this.conversationsRepository.getConversation(conversationId);
    if(!conversation){ return undefined; }
    let messages = await this.messagesService.getMessagesForConversation(conversation.conversationId);

    //return datasources so the UI can indicate which datasources belong to the conversation, and also prevent the datasource from trying to be added again, which is not allowed on the backend.
    const datasources = await this.datasourcesService.getDatasourcesForConversation(memberId, conversationId);
    conversation.datasources = datasources;

    if(includeDocumentsAsMessages){
      //get messages for datasource
      // const docs = await this.datasourcesService.getDocumentsForConversation(memberId, conversationId);
      for(let ds of datasources){
        const docs = await this.datasourcesService.getDocumentsForDatasource(memberId, ds.id);
        const documentsAsMessages = docs.map(d => formatDocumentAsMessage(memberId, ds, d));
        messages = [...messages, ...documentsAsMessages];
      }
    }
    //sort messages in ascending order
    messages.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());

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

  async addMessageToConversation(memberId: string, conversationId: string, message: CreateMessage, shouldEnsureMemberOwnership = true){
    if(shouldEnsureMemberOwnership){ //sometimes we want to add the message from the model
      await this.ensureMemberOwnsConversation(memberId, conversationId);
    }
    return await this.messagesService.createMessageForConversation(conversationId, memberId, message);
  }

  // async updateMessage(message: Message){
  //   return this.messagesService.updateMessage(message.messageId, message);
  // }

  async updateMessageStatusTopics(messageId: string, statusTopicKeyValues?: StatusTopicKeyValues){
    return this.messagesService.updateMessageStatusTopics(messageId, statusTopicKeyValues);
  }

  async getConversationsForMember(memberId: string){
    return await this.conversationsRepository.getConversationsForMember(memberId);
  }

  /**
   * DONT Add a snapshot of the documents for the datasource to the messages.
   * I went back and forth on whether to do this, or always pull the latest version of the document.
   * @param memberId
   * @param datasourceId
   * @param conversationId
   */
  async addDatasourceToConversation(memberId: string, datasourceId: number, conversationId: string){
    await this.ensureMemberOwnsConversation(memberId, conversationId);
    if(await this.conversationsRepository.doesDatasourceExistInConversation(conversationId, datasourceId)){
      throw new Error('Datasource is already part of the conversation and cant be added again or updated');
    }
    await this.conversationsRepository.addDatasourceToConversation(conversationId, datasourceId); //this will intentionally break if the datasource is already part of the conversation.

    // const documentsForDatasource = await this.datasourcesService.getDocumentsForDatasource(memberId, datasourceId);
    // for(let document of documentsForDatasource){
    //   const createMessage = formatDocumentAsMessage(document);
    //   await this.messagesService.createMessageForConversation(conversationId, memberId, createMessage);
    // }
  }

  async ensureMemberOwnsConversation(memberId: string, conversationId: string){
    if(memberId == config.getAiMemberId()){ return; }
    return this.conversationsRepository.ensureMemberOwnsConversation(memberId, conversationId);
  }

  async haveAiNameTheConversation(memberId: string, conversationId: string){
    await this.ensureMemberOwnsConversation(memberId, conversationId);

    const conversation = await this.getConversation(memberId, conversationId);
    if(!conversation) { return new Error('Conversation not found'); }

    const prompt = nameConversationPrompt(conversation);

    let openAiMessages = await createOpenAIMessagesFromMessages(conversation.messages || []);
    openAiMessages = openAiMessages.filter(m => m.role !== "tool"); //filter out tool calls
    const lastMessage = {role: 'user', content: prompt} as ChatCompletionMessageParam;
    openAiMessages = [...openAiMessages, lastMessage];
    const result = await this.inferenceService.nonStreamingInference(openAiMessages);
    console.log('have ai name the conversation result: ', result)
    const resultWithoutThinkTag = removeThinkTagFromLLMResponse(result);
    const updatedConversation = await this.updateConversation(memberId, conversationId, {
      conversationId: conversationId,
      createdDate: conversation.createdDate,
      conversationName: resultWithoutThinkTag
    });
    return updatedConversation;
  }

  async getAtAutoCompleteSuggestions(memberId: string, atMention: string){
    const text = atMention.replace("@", '');
    const suggestions = await this.conversationsRepository.getAutoCompleteSuggestions(memberId, text);

    const agentSuggestions: Suggestion[] = [
      {name: 'Web Search Agent', type: 'agent', id: '1'},
      {name: 'Web Page Agent', type: 'agent', id: '2'},
    ];
    // console.log(`suggestions for text: ${text}`, suggestions);
    return [...suggestions, ...agentSuggestions];
  }

}

// function formatDocumentAsMessage(document: Document){
//   const documentTextWithInstruction = documentPrompt(document);
//   const message: CreateMessage = {
//     messageText: documentTextWithInstruction,
//     role: "user"
//   };
//   return message;
// }

function formatDocumentAsMessage(memberId: string, datasource: Datasource, document: Document){
  const documentTextWithInstruction = documentPrompt(document);
  const message: Message = {
    messageText: documentTextWithInstruction,
    role: "user",
    createdDate: datasource.dateAddedToConversation!,
    sentByMemberId: memberId,
    messageId: '',
    messageContext: undefined,
    toolCallsJson: undefined,
    imageUrl: undefined,
  };
  return message;
}
