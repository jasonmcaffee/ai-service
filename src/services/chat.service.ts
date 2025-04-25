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
import { OpenaiWrapperServiceV2 } from './openAiWrapperV2.service';
import { CalculatorToolsService } from './agent/tools/calculatorTools.service';
import { PlanAndExecuteAgent } from '../models/agent/PlanAndExecuteAgent';
import { AiFunctionContextV2 } from '../models/agent/aiTypes';
import { MemberPromptService } from './memberPrompt.service';
import { SpeechAudioService } from './speechAudio.service';
import CombinedAiFunctionExecutors from "./agent/tools/CombinedAiFunctionExecutors";
import {WebSearchAgent} from "./agent/agents/webSearchAgent.service";
import {NewsAgent} from "./agent/agents/newsAgent.service";
import { ModelParams } from '../models/agent/aiTypes';
import { WebPageAgent } from './agent/agents/webPageAgent.service';
import { Agent } from './agent/agents/Agent';


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
              ) {}


  /**
   * Use an observable to stream back text as it's received from the LLM.
   * @param prompt
   * @param memberId
   * @param conversationId
   * @param modelId
   * @param shouldSearchWeb
   */
  async streamInference(prompt: string, memberId: string, conversationId: string, modelId?: string, shouldSearchWeb = false, shouldUsePlanTool = false, shouldRespondWithAudio = false, textToSpeechSpeed = 1, shouldUseAgentOfAgents = false, temperature = 0.7, top_p = 1, frequency_penalty = 0, presence_penalty = 0): Promise<Observable<string>> {
    console.log(`streamInference called. shouldSearchWeb: ${shouldSearchWeb}`);
    const messageContext = extractMessageContextFromMessage(prompt);
    const model = await this.getModelToUseForMessage(memberId, messageContext, modelId);
    //use rjx subject to send SSE updates to the client.
    const inferenceSSESubject = new InferenceSSESubject();
    //allow client to press stop button with abort controller.
    const abortController = new AbortController();
    this.abortControllers.set(memberId, {controller: abortController});

    this.streamInferenceWithConversation(memberId, conversationId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb, shouldUsePlanTool, shouldRespondWithAudio, textToSpeechSpeed, shouldUseAgentOfAgents, temperature, top_p, frequency_penalty, presence_penalty);

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

  private async getModelToUseForMessage(memberId: string, messageContext: MessageContext, modelId?: string){
    const modelIdForMessage = messageContext.models.length > 0 ? messageContext.models[0].id : modelId;
    return this.modelsService.getModelByIdOrGetDefault(memberId, modelIdForMessage);
  }

  async streamInferenceWithConversation(memberId: string, conversationId: string, model:Model,
                                        messageContext: MessageContext, inferenceSSESubject: InferenceSSESubject,
                                        abortController: AbortController, shouldSearchWeb: boolean, shouldUsePlanTool: boolean,
                                        shouldRespondWithAudio: boolean, textToSpeechSpeed: number, shouldUseAgentOfAgents: boolean,
                                        temperature: number, top_p: number, frequency_penalty: number, presence_penalty: number){
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

    //send user messages without <datasource> and <model> and replace prompt text.
    const conversationMessagesFromMember = conversation.messages?.filter(m => m.sentByMemberId === memberId) ?? [];
    await this.convertAtMentionTagsToMessageText(conversationMessagesFromMember, memberId);

    const toolService = shouldSearchWeb ? this.webToolsService : this.webToolsService;

    let openAiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: shouldRespondWithAudio ? getChatPageSystemPromptForAudioResponse() :  getChatPageSystemPromptForMarkdownResponse()},
      ...createOpenAIMessagesFromMessages(conversation.messages!)
    ];

    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [
        ...createOpenAIMessagesFromMessages([modelInitialMessage]), //we say that the model message is before that chat message...
        ...openAiMessages
      ]
    }

    const modelParams = {
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty
    };

    const handleCompletedResponseText = async (completeText: string) => {
      // console.log('handle response completed got: ', completeText);
      const formattedResponse = completeText;
      const statusTopicsKeyValues = inferenceSSESubject.getStatusTopicsKeyValues();
      await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText: formattedResponse, role: 'system', statusTopicsKeyValues}, false);
      this.abortControllers.delete(memberId);
      inferenceSSESubject.sendTextCompleteOnNextTick();
    }

    const handleError = async (e: any) => {
      this.abortControllers.delete(memberId);
      inferenceSSESubject.sendTextCompleteOnNextTick();
    }

    this.handleSendingAudio(inferenceSSESubject, shouldRespondWithAudio, memberId, textToSpeechSpeed);

    if(messageContext.agents.length > 0){
      this.handleUsingAgent(memberId, abortController, inferenceSSESubject, messageContext, model, handleCompletedResponseText, handleError, modelParams);
    } else if(shouldUsePlanTool){
      this.handleUsingPlanTool(model, memberId, toolService, inferenceSSESubject, abortController, messageText, openAiMessages, handleCompletedResponseText, handleError, modelParams);
    } else if(shouldSearchWeb) {
      this.handleUsingSearchWebTool(memberId, abortController, inferenceSSESubject, openAiMessages, model, handleCompletedResponseText, handleError, modelParams);
    } else if(shouldUseAgentOfAgents){
      this.handleUsingAgentOfAgents(memberId, abortController, inferenceSSESubject, openAiMessages, model, handleCompletedResponseText, handleError, modelParams);
    } else {
      this.handleNoTool(memberId, abortController, inferenceSSESubject, openAiMessages, model, handleCompletedResponseText, handleError, modelParams);
    }
  }

  private handleSendingAudio(inferenceSSESubject: InferenceSSESubject, shouldRespondWithAudio: boolean, memberId: string, textToSpeechSpeed: number){
    if(!shouldRespondWithAudio){ return; }

    const pendingAudio: {index: number, sentence: string, buffer?: Buffer}[] = [];
    let nextIndexToSend = 0;
    const audioPromises: Promise<Buffer>[] = [];

    const processPendingAudio = () => {
      while (nextIndexToSend < pendingAudio.length && pendingAudio[nextIndexToSend].buffer) {
        const item = pendingAudio[nextIndexToSend];
        const base64Audio = Buffer.from(item.buffer!).toString('base64');
        // console.log(`${Date.now()} sending audio for sentence: ${item.sentence}`);
        inferenceSSESubject.sendAudioOnNextTick(base64Audio, item.sentence);
        nextIndexToSend++;
      }
    };

    let doesResponseHaveAThinkTag = false;
    let hasThinkTagEnded = false;

    inferenceSSESubject.getSubject().subscribe({
      next: async (data: string) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.sentence) {

            if(parsed.sentence.indexOf('<think>') >= 0){
              doesResponseHaveAThinkTag = true;
            }
            if(parsed.sentence.indexOf('</think>') >= 0){
              hasThinkTagEnded = true;
            }

            if(doesResponseHaveAThinkTag && !hasThinkTagEnded){
              console.log(`skipping converting text to speech because sentence is inside of a think tag.`);
              return;
            }

            const plainTextSentence = convertMarkdownToPlainText(parsed.sentence);
            console.log(`original sentence: \n${parsed.sentence} \n plainText: ${plainTextSentence}`);

            const currentIndex = pendingAudio.length;
            pendingAudio.push({index: currentIndex, sentence: plainTextSentence});

            // Create a promise that resolves when this audio is processed
            const audioPromise = this.speechAudioService.textToSpeechSync(plainTextSentence, textToSpeechSpeed)
              .then(audioBuffer => {
                // Store the buffer with its metadata
                pendingAudio[currentIndex].buffer = audioBuffer;
                // Try to send pending audio immediately after each buffer is ready
                processPendingAudio();
                return audioBuffer;
              });

            audioPromises.push(audioPromise);
          }

          if(parsed.textEnd){
            // Wait for ALL audio to be processed before sending complete
            await Promise.all(audioPromises);
            // One final check to send any remaining audio
            processPendingAudio();
            console.log(`received textEnd and all promises are complete, so no more sentence, therefore audioEnd`);
            inferenceSSESubject.sendAudioCompleteOnNextTick();
          }
        } catch (error) {
          console.error("Error parsing data:", error);
        }
      }
    });
  }


  private handleNoTool(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, openAiMessages: ChatCompletionMessageParam[], model: Model, handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>, modelParams: ModelParams) {
    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: this.webToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
      modelParams,
    };
    const promise = this.openAiWrapperService.callOpenAiUsingModelAndSubjectStream({
      openAiMessages,
      model,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    promise.then(async ({ completeText }) => {
      await handleCompletedResponseText(completeText);
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }

  private handleUsingAgentOfAgents(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, openAiMessages: ChatCompletionMessageParam[], model: Model, handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>, modelParams: ModelParams) {
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
    promise.then(async ({ completeText }) => {
      inferenceSSESubject.sendText(completeText);
      await handleCompletedResponseText(completeText);
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }

  private async handleUsingAgent(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, messageContext: MessageContext, model: Model,
                                 handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>, modelParams: ModelParams) {
    const aiFunctionContext: AiFunctionContextV2 = { memberId, abortController, inferenceSSESubject, functionResultsStorage: {}, model, modelParams, };
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
      await handleCompletedResponseText(completeText);
    }catch(e){
      await handleError(e);
    }

  }

  private handleUsingSearchWebTool(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, openAiMessages: ChatCompletionMessageParam[], model: Model, handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>, modelParams: ModelParams) {
    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: this.webToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
      modelParams,
    };
    const promise = this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages,
      model,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    promise.then(async ({ completeText }) => {
      inferenceSSESubject.sendText(completeText);
      await handleCompletedResponseText(completeText);
    });
    promise.catch(async e => {
      await handleError(e);
    });
  }

  private handleUsingPlanTool(model: Model, memberId: string, toolService: WebToolsService, inferenceSSESubject: InferenceSSESubject, abortController: AbortController, messageText: string, openAiMessages: ChatCompletionMessageParam[], handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>, modelParams: ModelParams) {
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, this.openAiWrapperService, memberId, toolService, inferenceSSESubject, abortController);
    const promise = planAndExecuteAgent.planAndExecuteThenStreamResultsBack(messageText, openAiMessages, false, modelParams);
    promise.then(async ({ finalResponseFromLLM }) => {
      await handleCompletedResponseText(finalResponseFromLLM);
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
  private async convertAtMentionTagsToMessageText(conversationMessagesFromMember: Message[], memberId: string) {
    for (let m of conversationMessagesFromMember) {
      const messageContext = extractMessageContextFromMessage(m.messageText);
      //first strip out datasource and model tags.
      m.messageText = messageContext.textWithoutTags;
      //next replace all <prompt> tags with actual prompt text 'you are a friendly assistant'
      for (let p of messageContext.prompts) {
        const prompt = await this.memberPromptService.getPromptById(memberId, p.id);
        m.messageText = replacePromptTagWithPromptTextFromDbById(m.messageText, p.id, prompt?.promptText ?? '');
      }
    }
  }
}

