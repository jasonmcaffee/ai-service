import { Injectable } from '@nestjs/common';
import { WebToolsService } from '../tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../../openAiWrapperV2.service';
import {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import {AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult} from '../../../models/agent/aiTypes';
import { Model } from '../../../models/api/conversationApiModels';
import {chatCompletionTool, extractChatCompletionToolAnnotationValues} from "../tools/aiToolAnnotations";
import { withStatus } from '../../../utils/utils';

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

  private getWebSearchAgentPrompt(){
    return `
      You are an AI agent who is an expert at searching the web and/or fetching the contents of a single website, in order to fulfill the user's request.
      You analyze the user's request, deeply reason about what the user wants, and create one or more expertly crafted web queries to find information.
      You then carefully read through the search results, and extract meaningful quotes that pertain to the user's request.
      You provide exhaustive results and information, that is in depth and thorough.
      
      # Response Instructions
      Do not use any preamble in your response.
      Do not provide statements, summarizations, or synthesis.
      Do not ask followup questions.
      
      Your response should contain the following information:
      - You must include every search result you receive from the web search tool should be included in your response.
      - You must provide multiple relevant direct quotes from each search result. e.g. if wikipedia.org/rome has 10 quotes relevant to the user's request, you include each one of them.
      - url links where the direct quotes were obtained from.
      
      # Response Format
      Your response should be formatted in markdown.
      Quotes should be in quotation marks.
      Links should be the shortened name of the website the link points to. e.g. http://wikipedia.org should be wikipedia. 
      Do not alter links in any way.  Links must exactly match those returned from search tools.  e.g. don't change hyphens into underscores.
      
      ## Example Response
      Important: Your response should be in the same format as provided below in the exampleResponse tag:
      <exampleResponse>
      "Rome is the capital city and most populated comune (municipality) of Italy. It is also the capital of the Lazio region, the centre of the Metropolitan City." [romefacts](https://romefacts.com)
      
      "Rome is located in the central portion of the Italian peninsula, on the Tiber River about 15 miles (24 km) inland from the Tyrrhenian Sea." [brittanica](https://brittanica.com/rome)
      
      "From its beautiful buildings that have withstood time itself to the majestic, graceful, Mediterannean Pines." [wikipedia](https://wikipedia.org/rome)
      
      "While Roman mythology dates the founding of Rome at around 753 BC, the site has been inhabited for much longer, making it a major human settlement for over three millennia and one of the oldest continuously occupied cities in Europe." [wikipedia](https://wikipedia.org/rome)
      </exampleResponse>
      
      # IMPORTANT CONSIDERATIONS
      Never use any knowledge or information that is not directly mentioned in the provided search results.
      If the user prompt relates to information not found in the search results, simply state that you could not find any related information.
      Always verify that each and every search result returned by your calls to web tools are included in your response.
      Always validate that you match the desired response format before responding.
      Deeply reason about the above instructions, and verify that you have fulfilled all the requirements.
    `;
  }

  /**
   * Call the LLM, passing it the getWebSearchAgentPrompt and webToolsService tools.
   * Once the LLM is done calling the tools, return the complete response from the LLM.
   * @param prompt
   * @param originalAiFunctionContext
   */
  async handlePrompt(prompt: string, originalAiFunctionContext: AiFunctionContextV2){
    return withStatus(async (sendStatus) => {
      let openAiMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: this.getWebSearchAgentPrompt()},
        { role: 'user', content: prompt},
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
      sendStatus('Web search agent response: ', {agentText: completeText});
      return completeText;
    }, {context: originalAiFunctionContext, displayText: `Web Search Agent is searching the web: "${prompt}"`, topic:'agent'});

  }

  getToolsMetadata(): ChatCompletionTool[] {
    return extractChatCompletionToolAnnotationValues(this);
  }

}



