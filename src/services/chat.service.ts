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
import CombinedTools from "./agent/tools/CombinedTools";
import {WebSearchAgent} from "./agent/agents/webSearchAgent.service";
import {NewsAgent} from "./agent/agents/newsAgent.service";

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
              ) {}


  /**
   * Use an observable to stream back text as it's received from the LLM.
   * @param prompt
   * @param memberId
   * @param conversationId
   * @param modelId
   * @param shouldSearchWeb
   */
  async streamInference(prompt: string, memberId: string, conversationId: string, modelId?: string, shouldSearchWeb = false, shouldUsePlanTool = false, shouldRespondWithAudio = false, textToSpeechSpeed = 1, shouldUseAgentOfAgents = false): Promise<Observable<string>> {
    console.log(`streamInference called. shouldSearchWeb: ${shouldSearchWeb}`);
    const messageContext = extractMessageContextFromMessage(prompt);
    const model = await this.getModelToUseForMessage(memberId, messageContext, modelId);
    //use rjx subject to send SSE updates to the client.
    const inferenceSSESubject = new InferenceSSESubject();
    //allow client to press stop button with abort controller.
    const abortController = new AbortController();
    this.abortControllers.set(memberId, {controller: abortController});

    this.streamInferenceWithConversation(memberId, conversationId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb, shouldUsePlanTool, shouldRespondWithAudio, textToSpeechSpeed, shouldUseAgentOfAgents);

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
                                        shouldRespondWithAudio: boolean, textToSpeechSpeed: number, shouldUseAgentOfAgents: boolean){
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

    if(shouldUsePlanTool){
      this.handleUsingPlanTool(model, memberId, toolService, inferenceSSESubject, abortController, messageText, openAiMessages, handleCompletedResponseText, handleError);
    } else if(shouldSearchWeb) {
      this.handleUsingSearchWebTool(memberId, abortController, inferenceSSESubject, openAiMessages, model, handleCompletedResponseText, handleError);
    } else if(shouldUseAgentOfAgents){
      this.handleUsingAgentOfAgents(memberId, abortController, inferenceSSESubject, openAiMessages, model, handleCompletedResponseText, handleError);
    } else {
      this.handleNoTool(memberId, abortController, inferenceSSESubject, openAiMessages, model, handleCompletedResponseText, handleError);
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


  private handleNoTool(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, openAiMessages: ChatCompletionMessageParam[], model: Model, handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>) {
    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: this.webToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
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

  private handleUsingAgentOfAgents(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, openAiMessages: ChatCompletionMessageParam[], model: Model, handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>) {
    const combinedTools = new CombinedTools();
    combinedTools.registerTool(this.webSearchAgent);
    combinedTools.registerTool(this.newsAgent);

    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: combinedTools, //this.agentsAsToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
      model,
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

  private handleUsingSearchWebTool(memberId: string, abortController: AbortController, inferenceSSESubject: InferenceSSESubject, openAiMessages: ChatCompletionMessageParam[], model: Model, handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>) {
    const aiFunctionContext: AiFunctionContextV2 = {
      memberId,
      aiFunctionExecutor: this.webToolsService,
      abortController,
      inferenceSSESubject,
      functionResultsStorage: {},
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

  private handleUsingPlanTool(model: Model, memberId: string, toolService: WebToolsService, inferenceSSESubject: InferenceSSESubject, abortController: AbortController, messageText: string, openAiMessages: ChatCompletionMessageParam[], handleCompletedResponseText: (completeText: string) => Promise<void>, handleError: (e: any) => Promise<void>) {
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, this.openAiWrapperService, memberId, toolService, inferenceSSESubject, abortController);
    const promise = planAndExecuteAgent.planAndExecuteThenStreamResultsBack(messageText, openAiMessages, false);
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

