import { Injectable } from '@nestjs/common';
import { WebToolsService } from '../tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../../openAiWrapperV2.service';
import {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import {
  getChatPageSystemPromptForAudioResponse,
  getChatPageSystemPromptForMarkdownResponse,
} from '../../../utils/prompts';
import { createOpenAIMessagesFromMessages } from '../../../utils/utils';
import {AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult} from '../../../models/agent/aiTypes';
import { Model } from '../../../models/api/conversationApiModels';
import {chatCompletionTool, extractChatCompletionToolAnnotationValues} from "../tools/aiToolAnnotations";

/**
 * An agent is an abstraction that allows us to bundle prompts, tools, and behaviors together, and provides a simple
 * NLI function to interact with it.
 *
 * An agent has functions:
 * - handlePrompt - useful when not called on by AI
 * - aiHandlePrompt for when it's called on by another AI via tools.
 *
 * An agent has tools it can call.
 */
@Injectable()
export class WebSearchAgent implements AiFunctionExecutor<WebSearchAgent>{
  constructor(
      private readonly webToolsService: WebToolsService,
      private readonly openAiWrapperService: OpenaiWrapperServiceV2,) {}

  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiWebSearchAgent",
      description: `
        This agent is useful for all things related to searching the web, using a natural language interface.
        
        # searching the web.  
        Use a prompt to ask the web agent to search the web for a specific topic, query, etc.
        e.g. 'search the web for a recipe for chicken noodle soup.' 
        e.g. 'search the web the for how to fix a broken transmission.'
        
        # retrieving information from a single web page.
        Use a prompt to ask the web agent to retrieve the contents
        `,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "prompt to give to the web search agent.",
          },
        },
        required: ["prompt"],
      },
    }
  })
  async aiWebSearchAgent({prompt}: {prompt?: string} = {prompt: undefined}, context: AiFunctionContextV2): Promise<AiFunctionResult>{
    if(!prompt){ return {result: 'Error: no prompt was provided', context}; }
    const result = await this.handlePrompt(prompt, context);
    return {result: result, context};
  }

  private getWebSearchAgentPrompt(prompt: string){
    return `
      You are an AI agent who is an expert at using the provided tools to search the web.
      Using the provided user prompt, you expertly craft search queries, fetch web pages, etc to fulfill the request made in the prompt.
      
      The user prompt is:
      ${prompt}
    `;
  }

  /**
   * Call the LLM, passing it the getWebSearchAgentPrompt and webToolsService tools.
   * Once the LLM is done calling the tools, return the complete response from the LLM.
   * @param prompt
   * @param originalAiFunctionContext
   */
  async handlePrompt(prompt: string, originalAiFunctionContext: AiFunctionContextV2){
    let openAiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: this.getWebSearchAgentPrompt(prompt)},
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

  getToolsMetadata(): ChatCompletionTool[] {
    return extractChatCompletionToolAnnotationValues(this);
  }

}



