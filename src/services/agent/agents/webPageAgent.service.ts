import { Injectable } from '@nestjs/common';
import { WebToolsService } from '../tools/webTools.service';
import {defaultHandleToolCalls, HandleToolCalls, OpenaiWrapperServiceV2} from '../../openAiWrapperV2.service';
import {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import {AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult} from '../../../models/agent/aiTypes';
import { Model } from '../../../models/api/conversationApiModels';
import {chatCompletionTool, extractChatCompletionToolAnnotationValues} from "../tools/aiToolAnnotations";
import { withStatus } from '../../../utils/utils';
import { WebToolsNoMarkdownInSearchResultService } from '../tools/webToolsNoMarkdownInSearchResult.service';
import { Agent } from './Agent';
import {WebToolGetPageContentService} from "../tools/webToolGetPageContents.service";

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
export class WebPageAgent implements Agent<WebPageAgent>{
  constructor(
    private readonly webToolGetPageContentService: WebToolGetPageContentService,
    private readonly openAiWrapperService: OpenaiWrapperServiceV2,) {}

  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiAskWebPageAgentGeneralQuestionAboutUrl",
      description: `
        This agent is useful for all things related to getting the contents of a web page.
        
        # retrieving information from a single web page.
        Use a prompt to ask the web agent to retrieve the contents of a web page, and do something with that information.
        
        # summarize a web page
        Include a summarization of a web page, along with citations.
        `,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "prompt to give to the web page agent.",
          },
        },
        required: ["prompt"],
      },
    }
  })
  async aiAskWebPageAgentGeneralQuestionAboutUrl({prompt}: {prompt?: string} = {prompt: undefined}, context: AiFunctionContextV2): Promise<AiFunctionResult>{
    if(!prompt){ return {result: 'Error: no prompt was provided', context}; }
    const result = await this.handlePrompt(prompt, context);
    return {result: result, context};
  }

  handlePrompt(prompt: string, context: AiFunctionContextV2): Promise<string> {
    return withStatus(async (sendStatus) => {
      let openAiMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: getWebPageAgentGenericPrompt()},
        { role: 'user', content: prompt},
      ];
      const aiFunctionContext: AiFunctionContextV2 = { ...context, aiFunctionExecutor: this.webToolGetPageContentService};

      //add a follow up message to help ensure the llm follows instructions.
      const handleToolCalls: HandleToolCalls = async (p) : Promise<ChatCompletionMessageParam[]> => {
        const toolCallResultMessages = await defaultHandleToolCalls(p);
        const newMessage: ChatCompletionMessageParam = {role: 'user', content: getFollowUpPromptAfterToolCall(prompt)};
        toolCallResultMessages.push(newMessage);
        return toolCallResultMessages;
      };

      const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({ openAiMessages, model: context.model!, aiFunctionContext, handleToolCalls});


      // sendStatus('Web page agent response: ', {agentText: completeText});
      return completeText;
    }, {context, displayText: `Web Page Agent is handling request: "${prompt}"`, topic:'agent'});
  }

  getToolsMetadata(): ChatCompletionTool[] {
    return extractChatCompletionToolAnnotationValues(this);
  }

}


function getWebPageAgentGenericPrompt(){
  return `
      You are an AI agent who is an expert at fetching the contents of a single website, in order to fulfill the user's request.
      You will always first retrieve the contents of a web page first, then fulfill the user's request.
      Do not use preamble or follow up questions in your response.
      Follow the user's request exactly.
    `;
}

function getFollowUpPromptAfterToolCall(originalPrompt: string){
  return `
    Now that you have the results from the tool call, deeply reason about the user's request, and ensure that you follow the instructions exactly.
    The original request was:
    <originalRequest>
        ${originalPrompt}
    </originalRequest>
  `;
}

// function getWebPageAgentSummarizePrompt(){
//   return `
//       You are an AI agent who is an expert at fetching the contents of a single website, and provide a summary of the page, with citations (snippets of text from the page).
//
//     `;
// }


//
// @chatCompletionTool({
//   type: "function",
//   function: {
//     name: "aiAskWebPageAgentToSummarizeUrlAndProvideCitations",
//     description: `
//       Use this function to summarize the contents of a url, and include citations (snippets of text from the page)
//       `,
//     parameters: {
//       type: "object",
//       properties: {
//         url: {
//           type: "string",
//           description: "url to summarize",
//         },
//       },
//       required: ["url"],
//     },
//   }
// })
// async aiAskWebPageAgentToSummarizeUrlAndProvideCitations({url}: {url?: string} = {url: undefined}, context: AiFunctionContextV2): Promise<AiFunctionResult>{
//   if(!url){ return {result: 'Error: no prompt was provided', context}; }
//
//   const result = await withStatus(async (sendStatus) => {
//     let openAiMessages: ChatCompletionMessageParam[] = [
//       { role: 'system', content: getWebPageAgentSummarizePrompt()},
//       // { role: 'user', content: prompt},
//     ];
//     const aiFunctionContext = { ...context, aiFunctionExecutor: this.webToolsNoMarkdownInSearchResultService};
//     const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({ openAiMessages, model: context.model!, aiFunctionContext, totalOpenAiCallsMade: 0, });
//     sendStatus('Web search agent response: ', {agentText: completeText});
//     return completeText;
//   }, {context, displayText: `Web Page Agent is handling request: "${prompt}"`, topic:'agent'});
//
//   return {result: result, context};
// }
