import { Injectable } from '@nestjs/common';
import { WebToolsService } from '../tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../../openAiWrapperV2.service';
import {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import {AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult} from '../../../models/agent/aiTypes';
import { Model, SearchResult, SearchResultResponse } from '../../../models/api/conversationApiModels';
import {chatCompletionTool, extractChatCompletionToolAnnotationValues} from "../tools/aiToolAnnotations";
import { removeThinkTagFromLLMResponse, withStatus } from '../../../utils/utils';
import { WebToolsNoMarkdownInSearchResultService } from '../tools/webToolsNoMarkdownInSearchResult.service';
import { Agent } from './Agent';
import { WebPageAgent } from './webPageAgent.service';
import CombinedAiFunctionExecutors from '../tools/CombinedAiFunctionExecutors';

type WebPageAgentResponse = {
  url: string,
  response: string,
}
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
export class WebSearchAgent implements Agent<WebSearchAgent>{
  constructor(
      private readonly webToolsNoMarkdownInSearchResultService: WebToolsNoMarkdownInSearchResultService,
      private readonly webPageAgent: WebPageAgent,
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

  async handlePrompt(prompt: string, originalAiFunctionContext: AiFunctionContextV2){
    return withStatus(async (sendStatus) => {

      const aiFunctionContext = { ...originalAiFunctionContext, aiFunctionExecutor: CombinedAiFunctionExecutors.createFrom(this.webToolsNoMarkdownInSearchResultService, this.webPageAgent),};

      const searchQuery = await this.haveAiCreateSearchQuery(prompt, originalAiFunctionContext);
      const {result: webSearchResult} = await this.webToolsNoMarkdownInSearchResultService.aiSearchWeb({query: searchQuery}, originalAiFunctionContext);

      let results = (webSearchResult as SearchResultResponse).searchResults;
      const webPageAgentResponses = [] as WebPageAgentResponse[];
      for(let searchResult of results){
        const webPageAgentResponse = await this.webPageAgent.handlePrompt(getWebPageAgentPrompt(searchResult.url), aiFunctionContext);
        webPageAgentResponses.push({url: searchResult.url, response: webPageAgentResponse});
      }


      let openAiMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: getWebSearchAgentPromptV2(webPageAgentResponses)},
        { role: 'user', content: prompt},
      ];

      // const aiFunctionContext = { ...originalAiFunctionContext, aiFunctionExecutor: CombinedAiFunctionExecutors.createFrom(this.webToolsNoMarkdownInSearchResultService, this.webPageAgent),};
      const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
        openAiMessages,
        model: originalAiFunctionContext.model!,
        aiFunctionContext,
      });
      sendStatus('Web search agent response: ', {agentText: completeText});
      return completeText;
    }, {context: originalAiFunctionContext, displayText: `Web Search Agent is searching the web: "${prompt}"`, topic:'agent'});
  }

  private async haveAiCreateSearchQuery(prompt: string, context: AiFunctionContextV2){
    return withStatus(async (sendStatus) => {
      let openAiMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: `
          You are a helpful ai assistant that is an expert at crafting a web search query to fulfill the user's request.  
          You only respond with the search query to be used, without using any preamble or follow up questions.
          `},
        { role: 'user', content: prompt},
      ];

      const aiFunctionContext = { ...context, aiFunctionExecutor: undefined,};
      const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
        openAiMessages,
        model: context.model!,
        aiFunctionContext,
      });
      const completeTextWithoutThinkTag = removeThinkTagFromLLMResponse(completeText);
      sendStatus('Web search agent response: ', {agentText: completeTextWithoutThinkTag});
      return completeTextWithoutThinkTag;
    }, {context, displayText: `Web Search Agent is creating a search query for prompt: "${prompt}"`, topic:'agent'});
  }

  getToolsMetadata(): ChatCompletionTool[] {
    return extractChatCompletionToolAnnotationValues(this);
  }

}

function getWebSearchAgentPromptV2(webPageAgentResponses: WebPageAgentResponse[]) {
  const formattedWebPageAgentResponses = webPageAgentResponses.map(r => {
    return `
      <webPage>
        <url>${r.url}</url>
        <content>${r.response}</content>
      </webPage>
    `
  }).join('\n');

  return `
  You are an AI agent who is an expert at processing web search results order to fulfill the user's request.
  You do not respond with preamble, or with follow up questions.
  
  Using the only data found in the search results below, fulfill the user's request:
  <searchResults>
    ${formattedWebPageAgentResponses}
  </searchResults>
  `;
}

function getWebPageAgentPrompt(url: string){
  return `
Visit this URL: ${url}
Task: Please analyze this web page and provide:

SUMMARY: Create a comprehensive summary of the article that captures the key facts, events, and context.

CITATIONS: After your summary, include a citations section where you list 10 exact quotes from the original article that support the claims made in your summary. For each citation:

Use quotation marks to indicate direct quotes
Include enough context to understand the significance of the quote
Organize citations in a logical order that follows your summary's structure

Format your response with clear headings for both the SUMMARY and CITATIONS sections.
  `;
}



// Smaller models don't listen to instructions, and will stop processing search results.
// function getWebSearchAgentPrompt(){
//   return `
// You are an AI agent who is an expert at searching the web in order to fulfill the user's request.
//
// For each search result you receive, perform the following steps:
//
// 1. Call the aiAskWebPageAgentGeneralQuestionAboutUrl function for each result URL
// 2. Pass the URL to the function within the prompt template shown below
// 3. Collect and analyze all responses to create a comprehensive answer
//
// When calling aiAskWebPageAgentGeneralQuestionAboutUrl, use this exact prompt for each URL: (replace urlFromSearchResult with actual url)
// <promptToSend>
// Visit this URL: {urlFromSearchResult}
// Task: Please analyze this web page and provide:
//
// SUMMARY: Create a comprehensive summary of the article that captures the key facts, events, and context.
//
// CITATIONS: After your summary, include a citations section where you list 10 exact quotes from the original article that support the claims made in your summary. For each citation:
//
// Use quotation marks to indicate direct quotes
// Include enough context to understand the significance of the quote
// Organize citations in a logical order that follows your summary's structure
//
// Format your response with clear headings for both the SUMMARY and CITATIONS sections.
// </promptToSend>
//
// Important instructions:
// - Process ALL search results you receive - if you have 10 results, make 10 separate function calls
// - Do not skip any search results.  After each result from aiAskWebPageAgentGeneralQuestionAboutUrl, you should evaluate how many search results you've processed, and how many more are needed.
// - Use the information gathered from all web pages to synthesize a complete answer
// - Present the information in a clear, organized format with appropriate headings and sections
// - When citing information, indicate which source it came from
//     `;
// }

// async handlePrompt(prompt: string, originalAiFunctionContext: AiFunctionContextV2){
//   return withStatus(async (sendStatus) => {
//     let openAiMessages: ChatCompletionMessageParam[] = [
//       { role: 'system', content: getWebSearchAgentPrompt()},
//       { role: 'user', content: prompt},
//     ];
//
//     const aiFunctionContext = { ...originalAiFunctionContext, aiFunctionExecutor: CombinedAiFunctionExecutors.createFrom(this.webToolsNoMarkdownInSearchResultService, this.webPageAgent),};
//     const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
//       openAiMessages,
//       model: originalAiFunctionContext.model!,
//       aiFunctionContext,
//     });
//     sendStatus('Web search agent response: ', {agentText: completeText});
//     return completeText;
//   }, {context: originalAiFunctionContext, displayText: `Web Search Agent is searching the web: "${prompt}"`, topic:'agent'});
// }
