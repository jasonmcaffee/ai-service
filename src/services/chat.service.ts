import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { ConversationService } from './conversation.service';
import { Message, MessageContext, Model } from '../models/api/conversationApiModels';
import { ChatCompletionMessageParam, } from 'openai/resources/chat/completions';
import {
  convertMarkdownToPlainText,
  createOpenAIMessagesFromMessages,
  extractMessageContextFromMessage,
  replacePromptTagWithPromptTextFromDbById,
} from '../utils/utils';
import { getChatPageSystemPromptForAudioResponse, getChatPageSystemPromptForMarkdownResponse } from '../utils/prompts';
import { ModelsService } from './models.service';
import InferenceSSESubject from "../models/InferenceSSESubject";
import {WebToolsService} from "./agent/tools/webTools.service";
import {OpenaiWrapperServiceV2 } from './openAiWrapperV2.service';
import { CalculatorToolsService } from './agent/tools/calculatorTools.service';
import { PlanAndExecuteAgent } from '../models/agent/PlanAndExecuteAgent';
import { AiFunctionContextV2, OnOpenAiMessagesAdded } from '../models/agent/aiTypes';
import { MemberPromptService } from './memberPrompt.service';
import { SpeechAudioService } from './speechAudio.service';
import CombinedAiFunctionExecutors from "./agent/tools/CombinedAiFunctionExecutors";
import {WebSearchAgent} from "./agent/agents/webSearchAgent.service";
import {NewsAgent} from "./agent/agents/newsAgent.service";
import { ModelParams } from '../models/agent/aiTypes';
import { WebPageAgent } from './agent/agents/webPageAgent.service';
import { Agent } from './agent/agents/Agent';
import { ChatAudioService } from './chatAudio.service';
import { ChatCompletionAssistantMessageParam } from 'openai/src/resources/chat/completions';

type AiStrategyParams = {
  memberId: string,
  abortController: AbortController,
  inferenceSSESubject: InferenceSSESubject,
  messageContext: MessageContext,
  model: Model,
  handleCompletedResponseText: (completeText: string, allOpenAiMessages: ChatCompletionMessageParam[]) => Promise<void>,
  handleError: (e: any) => Promise<void>, modelParams: ModelParams,
  openAiMessages: ChatCompletionMessageParam[],
  onOpenAiMessagesAdded: OnOpenAiMessagesAdded,
}

@Injectable()
export class ChatService {
  //clientId to abortcontroller map so we can stop.
  private abortControllers: Map<string, { controller: AbortController }> = new Map();

  constructor(private readonly conversationService: ConversationService,
              private readonly modelsService: ModelsService,
              private readonly webToolsService: WebToolsService,
              private readonly openAiWrapperService: OpenaiWrapperServiceV2,
              private readonly memberPromptService: MemberPromptService,
              private readonly speechAudioService: SpeechAudioService,
              private readonly webSearchAgent: WebSearchAgent,
              private readonly newsAgent: NewsAgent,
              private readonly webPageAgent: WebPageAgent,
              private readonly chatAudioService: ChatAudioService,
              ) {}


  /**
   * Use an observable to stream back text as it's received from the LLM.
   * @param prompt
   * @param memberId
   * @param conversationId
   * @param modelId
   * @param shouldSearchWeb
   */
  async streamInference(prompt: string, memberId: string, conversationId: string, modelId?: string, shouldSearchWeb = false, shouldUsePlanTool = false, shouldRespondWithAudio = false, textToSpeechSpeed = 1,
                        shouldUseAgentOfAgents = false, temperature = 0.7, top_p = 1, frequency_penalty = 0, presence_penalty = 0, imageUrl: string | undefined = undefined): Promise<Observable<string>> {
    console.log(`streamInference called. shouldSearchWeb: ${shouldSearchWeb}`);
    const messageContext = extractMessageContextFromMessage(prompt);
    const model = await this.getModelToUseForMessage(memberId, messageContext, modelId);
    //use rjx subject to send SSE updates to the client.
    const inferenceSSESubject = new InferenceSSESubject();
    //allow client to press stop button with abort controller.
    const abortController = new AbortController();
    this.abortControllers.set(memberId, {controller: abortController});

    this.streamInferenceWithConversation(memberId, conversationId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb, shouldUsePlanTool, shouldRespondWithAudio, textToSpeechSpeed, shouldUseAgentOfAgents, temperature, top_p, frequency_penalty, presence_penalty, imageUrl);

    return inferenceSSESubject.getSubject();
  }

  /**
   * Stop current generation for the member id.  Assumes 1 generation per member at a time
   * @param memberId
   */
  async stop(memberId: string){
    const associatedAbortController = this.abortControllers.get(memberId);
    if(!associatedAbortController){
      return console.log(`no associated abort controller for member id: ${memberId}`);
    }
    console.log(`aborting controller`)
    associatedAbortController.controller.abort();
    this.abortControllers.delete(memberId);
  }

  //TODO: This needs to be the running model for llama.cpp.  Else you get a default options, but talking to running model.
  private async getModelToUseForMessage(memberId: string, messageContext: MessageContext, modelId?: string){
    const modelIdForMessage = messageContext.models.length > 0 ? messageContext.models[0].id : modelId;
    return this.modelsService.getModelByIdOrGetDefault(memberId, modelIdForMessage);
  }

  async streamInferenceWithConversation(memberId: string, conversationId: string, model:Model,
                                        messageContext: MessageContext, inferenceSSESubject: InferenceSSESubject,
                                        abortController: AbortController, shouldSearchWeb: boolean, shouldUsePlanTool: boolean,
                                        shouldRespondWithAudio: boolean, textToSpeechSpeed: number, shouldUseAgentOfAgents: boolean,
                                        temperature: number, top_p: number, frequency_penalty: number, presence_penalty: number,  imageUrl: string | undefined){
    //add datasources to conversation
    for (let datasourceContext of messageContext.datasources) {
      await this.conversationService.addDatasourceToConversation(memberId, parseInt(datasourceContext.id), conversationId);
    }

    const messageText = messageContext.originalText; //store the original text, unaltered.  alter before sending out.  // messageContext.textWithoutTags;
    //add the prompt to the messages table
    await this.conversationService.addMessageToConversation(memberId, conversationId, {messageText, role: 'user', toolCallsJson: undefined, imageUrl});
    //get all the messages in the conversation
    const conversation = await this.conversationService.getConversation(memberId, conversationId, true);
    if(!conversation){ throw new Error('Conversation not found'); }

    //send user messages without <datasource> and <model> and replace prompt text.
    const conversationMessagesFromMember = conversation.messages?.filter(m => m.sentByMemberId === memberId) ?? [];
    //todo this is wonky and modifies too much state.
    await this.convertAtMentionTagsToMessageText(conversationMessagesFromMember, memberId, messageContext);

    let openAiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: shouldRespondWithAudio ? getChatPageSystemPromptForAudioResponse() :  getChatPageSystemPromptForMarkdownResponse()},
      ... await createOpenAIMessagesFromMessages(conversation.messages!)
    ];

    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system', toolCallsJson: undefined, imageUrl: undefined};
      openAiMessages = [
        ... await createOpenAIMessagesFromMessages([modelInitialMessage]), //we say that the model message is before that chat message...
        ...openAiMessages
      ]
    }

    const modelParams = { temperature, top_p, frequency_penalty, presence_penalty };

    // we need to update the status topics once we get the last message from the assistant.  due to agents, this can be at different times.
    let lastAssistantMessage: Message | undefined;
    const handleCompletedResponseText = async (completeText: string, allOpenAiMessages: ChatCompletionMessageParam[]) => {
      const statusTopicsKeyValues = inferenceSSESubject.getStatusTopicsKeyValues();
      if(statusTopicsKeyValues && lastAssistantMessage){
        lastAssistantMessage.statusTopicsKeyValues = statusTopicsKeyValues;
        await this.conversationService.updateMessageStatusTopics(lastAssistantMessage.messageId, statusTopicsKeyValues);
      }

      this.abortControllers.delete(memberId);
      inferenceSSESubject.sendTextCompleteOnNextTick();
    }


    const onOpenAiMessagesAdded: OnOpenAiMessagesAdded = async ({openAiMessages}) => {
      for(let m of openAiMessages){
        if(m.role === 'assistant'){
          const assistantMessage = m as ChatCompletionAssistantMessageParam;
          const toolCallsJson = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 ? JSON.stringify(assistantMessage.tool_calls) : undefined;
          const messageText = assistantMessage.content as string;
          lastAssistantMessage = await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText, role: m.role, statusTopicsKeyValues: undefined, toolCallsJson, imageUrl: undefined}, false);
        }else if(m.role === 'tool'){
          const messageText = JSON.stringify({tool_call_id: m.tool_call_id, content: m.content});
          await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText, role: m.role, statusTopicsKeyValues: undefined, toolCallsJson: undefined, imageUrl: undefined}, false);
        }else{
          const messageText = m.content as string;
          await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText, role: m.role, statusTopicsKeyValues: undefined, toolCallsJson: undefined, imageUrl: undefined}, false);
        }
      }
    }

    const handleError = async (e: any) => {
      this.abortControllers.delete(memberId);
      inferenceSSESubject.sendTextCompleteOnNextTick();
    }

    this.chatAudioService.handleSendingAudio(inferenceSSESubject, shouldRespondWithAudio, memberId, textToSpeechSpeed);

    const aiStrategyParams: AiStrategyParams = {
      memberId, openAiMessages, model, modelParams, messageContext, inferenceSSESubject, abortController, handleCompletedResponseText, handleError, onOpenAiMessagesAdded,
    }
    if(messageContext.agents.length > 0){
      this.handleUsingAgent(aiStrategyParams);
    } else if(shouldUsePlanTool){
      this.handleUsingPlanTool(aiStrategyParams);
    } else if(shouldSearchWeb) {
      this.handleUsingSearchWebTool(aiStrategyParams);
    } else if(shouldUseAgentOfAgents){
      this.handleUsingAgentOfAgents(aiStrategyParams);
    } else {
      this.handleNoTool(aiStrategyParams);
    }
  }

  private handleNoTool({memberId, abortController, inferenceSSESubject, modelParams, model, handleCompletedResponseText, handleError, openAiMessages, onOpenAiMessagesAdded}: AiStrategyParams) {
    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      // aiFunctionExecutor: this.webToolsService,
      aiFunctionExecutor: undefined,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
      modelParams,
      onOpenAiMessagesAdded,
    };
    const promise = this.openAiWrapperService.callOpenAiUsingModelAndSubjectStream({
      openAiMessages,
      model,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    promise.then(async ({ completeText, openAiMessages }) => {
      await handleCompletedResponseText(completeText, openAiMessages );
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }

  private handleUsingAgentOfAgents({memberId, abortController, inferenceSSESubject, model, modelParams, openAiMessages, handleCompletedResponseText, handleError}: AiStrategyParams) {
    const combinedTools = new CombinedAiFunctionExecutors();
    combinedTools.combineAiFunctionExecutor(this.webSearchAgent);
    combinedTools.combineAiFunctionExecutor(this.newsAgent);

    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: combinedTools, //this.agentsAsToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
      model,
      modelParams,
    };
    const promise = this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages,
      model,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    promise.then(async ({ completeText, openAiMessages }) => {
      inferenceSSESubject.sendText(completeText);
      await handleCompletedResponseText(completeText, openAiMessages);
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }


  private async handleUsingAgent({memberId, abortController, inferenceSSESubject, messageContext, model, modelParams, handleCompletedResponseText, handleError, onOpenAiMessagesAdded}: AiStrategyParams) {
    const aiFunctionContext: AiFunctionContextV2 = { memberId, abortController, inferenceSSESubject, functionResultsStorage: {}, model, modelParams, onOpenAiMessagesAdded};
    const agent = messageContext.agents[0];
    const agentMap: Record<string, Agent<any>> = {
      "1": this.webSearchAgent,
      "2": this.webPageAgent,
    };
    const selectedAgent = agentMap[agent.id];
    try{
      if(!selectedAgent){
        throw new Error(`unknown agent id: ${agent.id}`);
      }
      const completeText = await selectedAgent.handlePrompt(messageContext.textWithoutTags, aiFunctionContext);
      inferenceSSESubject.sendText(completeText);
      await handleCompletedResponseText(completeText, []);
    }catch(e){
      await handleError(e);
    }

  }

  private handleUsingSearchWebTool({memberId, abortController, inferenceSSESubject, modelParams, openAiMessages, model, handleCompletedResponseText, handleError, onOpenAiMessagesAdded}: AiStrategyParams) {
    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: this.webToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
      modelParams,
      onOpenAiMessagesAdded
    };
    const promise = this.openAiWrapperService.callOpenAiUsingModelAndSubjectStream({
      openAiMessages,
      model,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    promise.then(async ({ completeText, openAiMessages }) => {
      inferenceSSESubject.sendText(completeText);
      await handleCompletedResponseText(completeText, openAiMessages);
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }

  private handleUsingPlanTool({model, inferenceSSESubject, memberId, abortController, openAiMessages, modelParams, handleCompletedResponseText, handleError, messageContext, onOpenAiMessagesAdded}: AiStrategyParams) {
    const toolService = this.webToolsService;
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, this.openAiWrapperService, memberId, toolService, inferenceSSESubject, abortController, onOpenAiMessagesAdded);
    const promise = planAndExecuteAgent.planAndExecuteThenStreamResultsBack(messageContext.originalText, openAiMessages, false, modelParams);
    promise.then(async ({ finalResponseFromLLM, openAiMessages }) => {
      await handleCompletedResponseText(finalResponseFromLLM, openAiMessages || []);
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }

  /**
   * Remove datasource and model tags.
   * Replace <prompt> tags with promptText from db.
   * Todo: optimize db lookup.
   * @param conversationMessagesFromMember
   * @param memberId
   * @private
   */
  private async convertAtMentionTagsToMessageText(conversationMessagesFromMember: Message[], memberId: string, newMessageContext: MessageContext) {
    const promptIdsUsedInAllMessagesSet = new Set<string>();
    const messageContextsAndMessages = [] as ({message: Message, messageContext: MessageContext})[];
    for (let m of conversationMessagesFromMember) {
      const messageContext = extractMessageContextFromMessage(m.messageText);
      messageContextsAndMessages.push({message: m, messageContext});
      for (let p of messageContext.prompts) {
        promptIdsUsedInAllMessagesSet.add(p.id);
      }
    }
    const promptIdsUsedInAllMessages = Array.from(promptIdsUsedInAllMessagesSet);
    const promptsUsedInAllMessages = await this.memberPromptService.getPromptByIds(memberId, promptIdsUsedInAllMessages);
    if(promptsUsedInAllMessages && promptsUsedInAllMessages.length > 0){
      for(let {message, messageContext} of messageContextsAndMessages){
        message.messageText = messageContext.textWithoutTags;
        for (let p of messageContext.prompts) {
          const prompt = promptsUsedInAllMessages.find((prompt) => prompt.id == p.id);
          message.messageText = replacePromptTagWithPromptTextFromDbById(message.messageText, p.id, prompt?.promptText ?? '')
        }
      }

      for (let p of newMessageContext.prompts) {
        const prompt = promptsUsedInAllMessages.find((prompt) => prompt.id == p.id);
        newMessageContext.textWithoutTags = replacePromptTagWithPromptTextFromDbById(newMessageContext.textWithoutTags, p.id, prompt?.promptText ?? '')
      }
    }
  }
}

