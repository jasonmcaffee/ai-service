import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { ConversationService } from './conversation.service';
import {MessageContext, Model} from '../models/api/conversationApiModels';
import { ChatCompletionMessageParam, } from 'openai/resources/chat/completions';
import { createOpenAIMessagesFromMessages, extractMessageContextFromMessage, } from '../utils/utils';
import { getChatPageSystemPrompt } from '../utils/prompts';
import { ModelsService } from './models.service';
import InferenceSSESubject from "../models/InferenceSSESubject";
import {WebToolsService} from "./agent/tools/webTools.service";
import { OpenaiWrapperServiceV2 } from './openAiWrapperV2.service';
import { CalculatorToolsService } from './agent/tools/calculatorTools.service';
import { PlanAndExecuteAgent } from '../models/agent/PlanAndExecuteAgent';

@Injectable()
export class ChatService {
  //clientId to abortcontroller map so we can stop.
  private abortControllers: Map<string, { controller: AbortController }> = new Map();

  constructor(private readonly conversationService: ConversationService,
              private readonly modelsService: ModelsService,
              private readonly webToolsService: WebToolsService,
              private readonly openAiWrapperService: OpenaiWrapperServiceV2,
              private readonly calculatorToolsService: CalculatorToolsService,) {}


  /**
   * Use an observable to stream back text as it's received from the LLM.
   * @param prompt
   * @param memberId
   * @param conversationId
   * @param modelId
   * @param shouldSearchWeb
   */
  async streamInference(prompt: string, memberId: string, conversationId?: string, modelId?: string, shouldSearchWeb = false): Promise<Observable<string>> {
    console.log(`streamInference called. shouldSearchWeb: ${shouldSearchWeb}`);
    const messageContext = extractMessageContextFromMessage(prompt);
    const model = await this.getModelToUseForMessage(memberId, messageContext, modelId);
    //use rjx subject to send SSE updates to the client.
    const inferenceSSESubject = new InferenceSSESubject();
    //allow client to press stop button with abort controller.
    const abortController = new AbortController();
    this.abortControllers.set(memberId, {controller: abortController});
    if(conversationId){
      this.streamInferenceWithConversation(memberId, conversationId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb);
    }else { //eg. name the conversation?
      this.streamInferenceWithoutConversation(memberId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb);
    }
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
                                        abortController: AbortController, shouldSearchWeb: boolean){
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

    const toolService = shouldSearchWeb ? this.webToolsService : undefined;

    let openAiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: getChatPageSystemPrompt()},
      ...createOpenAIMessagesFromMessages(conversation.messages!)
    ];

    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [
        ...createOpenAIMessagesFromMessages([modelInitialMessage]),
        ...openAiMessages
      ]
    }

    const planAndExecuteAgent = new PlanAndExecuteAgent(model, this.openAiWrapperService, memberId, toolService, inferenceSSESubject, abortController);
    const promise = planAndExecuteAgent.planAndExecuteThenStreamResultsBack(messageText, openAiMessages, false);
    // promise.then(({openAiMessages, completeText}) => {
    promise.then(async ({finalResponseFromLLM}) => {
      const completeText = finalResponseFromLLM;
      console.log('handle response completed got: ', completeText);
      const formattedResponse = completeText;
      const statusTopicsKeyValues = inferenceSSESubject.getStatusTopicsKeyValues();
      await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText: formattedResponse, role: 'system', statusTopicsKeyValues}, false);
      this.abortControllers.delete(memberId);
      inferenceSSESubject.sendCompleteOnNextTick();
    });
    promise.catch(e => {
      this.abortControllers.delete(memberId);
      inferenceSSESubject.sendCompleteOnNextTick();
    });
  }

  async streamInferenceWithoutConversation(memberId: string, model: Model, messageContext: MessageContext,
                                           inferenceSSESubject: InferenceSSESubject, abortController: AbortController,
                                           shouldSearchWeb: boolean) {
    throw new Error('not supported yet');
    // const prompt = messageContext.textWithoutTags;
    // const userMessage = {messageText: prompt, sentByMemberId: memberId, messageId: '', createdDate: '', role: 'user'};
    // let openAiMessages: ChatCompletionMessageParam[] = [{ role: 'system', content: getChatPageSystemPrompt()}, ...createOpenAIMessagesFromMessages([userMessage])];
    //
    // const tools = shouldSearchWeb ? this.webToolsService.getToolsMetadata() : [];
    // if(model.initialMessage){
    //   const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
    //   openAiMessages = [
    //     {role: "system", content: getToolsPrompt(tools)},
    //     ...createOpenAIMessagesFromMessages([modelInitialMessage]),
    //     ...openAiMessages
    //   ];
    //}
    //todo:

    // this.openAiWrapperService.callOpenAiUsingModelAndSubject({
    //   openAiMessages,
    //   model,
    //   memberId,
    //   inferenceSSESubject,
    //   abortController,
    //   toolService: this.webToolsService,
    //   tools,
    // }).finally(()=>{
    //   this.abortControllers.delete(memberId);
    // });
    // this.openAiWrapperService.callOpenAiUsingModelAndSubject(openAiMessages, ()=>{}, handleOnComplete, handleError, model, memberId, inferenceSSESubject, abortController, this.webToolsService, tools);
    // }
  }
}


//from chatgpt
//data: 429 You exceeded your current quota
