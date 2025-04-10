import { Injectable } from '@nestjs/common';
import { WebToolsService } from './tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../openAiWrapperV2.service';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  getChatPageSystemPromptForAudioResponse,
  getChatPageSystemPromptForMarkdownResponse,
} from '../../utils/prompts';
import { createOpenAIMessagesFromMessages } from '../../utils/utils';
import { AiFunctionContextV2 } from '../../models/agent/aiTypes';
import { Model } from '../../models/api/conversationApiModels';

@Injectable()
export class WebSearchAgent{
  constructor(private readonly webToolsService: WebToolsService, private readonly openAiWrapperService: OpenaiWrapperServiceV2,) {}

  async handlePrompt(prompt: string, originalAiFunctionContext: AiFunctionContextV2){
    let openAiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: getWebSearchAgentPrompt(prompt)},
    ];

    const aiFunctionContext: AiFunctionContextV2 = {
      memberId: originalAiFunctionContext.memberId,
      aiFunctionExecutor: this.webToolsService,
      abortController: originalAiFunctionContext.abortController,
      inferenceSSESubject: originalAiFunctionContext.inferenceSSESubject,
      functionResultsStorage: originalAiFunctionContext.functionResultsStorage,
      model: originalAiFunctionContext.model,
    };
    const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages,
      model: originalAiFunctionContext.model!,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    return completeText;
  }

}


function getWebSearchAgentPrompt(prompt: string){
  return `
  You are an AI agent who is an expert at using the provided tools to search the web.
  Using the provided user prompt, you expertly craft search queries, fetch web pages, etc to fulfill the request made in the prompt.
  
  The user prompt is:
  ${prompt}
  `
}
