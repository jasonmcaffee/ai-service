import { Injectable } from '@nestjs/common';
import { WebToolsService } from '../tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../../openAiWrapperV2.service';
import {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import {
    getChatPageSystemPromptForAudioResponse,
    getChatPageSystemPromptForMarkdownResponse,
} from '../../../utils/prompts';
import {createOpenAIMessagesFromMessages, uuid} from '../../../utils/utils';
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
export class NewsAgent implements AiFunctionExecutor<NewsAgent>{
    constructor(
        private readonly webToolsService: WebToolsService,
        private readonly openAiWrapperService: OpenaiWrapperServiceV2,) {}

    @chatCompletionTool({
        type: "function",
        function: {
            name: "aiNewsAgent",
            description: `
        This agent is useful for all things related to news.
        
        # getting the latest news
        Use a prompt to ask the news agent to get the latest news headlines
        e.g. 'give me a summary of the latest news headlines' 
        e.g. 'what is going on in the news?'
        e.g. 'what is the latest on the war going on over seas?'
        
        `,
            parameters: {
                type: "object",
                properties: {
                    prompt: {
                        type: "string",
                        description: "prompt to give to the news  agent.",
                    },
                },
                required: ["prompt"],
            },
        }
    })
    async aiNewsAgent({prompt}: {prompt?: string} = {prompt: undefined}, context: AiFunctionContextV2): Promise<AiFunctionResult>{
        if(!prompt){ return {result: 'Error: no prompt was provided', context}; }
        const result = await this.handlePrompt(prompt, context);
        return {result: result, context};
    }

    private getNewsAgentPrompt(prompt: string){
        return `
      You are an AI agent who is an expert at using the provided tools to get latest news headlines from the web.
      Using the provided user prompt, you expertly craft search queries, fetch web pages, etc to fulfill the request made in the prompt.
      
      # Response Format
      Do not use any preamble in your response.
      Do not ask followup questions.
      Your response should be formatted in markdown.
      Each headline should be a header # 
      Under each headline should be a summary of all the information you found related to the headline.
      Under the summary, a list of sources should be provided, with url links to the article for the headline.
      
      Example response from you can be found inside the exampleResponse tag below:
      <exampleResponse>
      # War Tensions Escalate
      Today, tensions escalated between Saudi Arabia and Yemen.  
      
      ## Sources: 
      Foxnews reports that Yemen launched a missle strike, killing 14. [1](http://local.ai/1)
      
      Cnn reports the missle strike killed 22. [2](http://local.ai/2)
      
      # Tariff Escalation
      Today, president Trump issued a new tariff on imported cheese from Pakistan, causing prices to increase.
      
      ## Sources: 
      Foxnews reports that the escalation was the fault of democrats [1](http://local.ai/3)
      
      Cnn reports that the escalation was the fault of republicans. [2](http://local.ai/3)
      
      </exampleResponse>
      
      Always validate that you match the desired response format before responding.
    `;
    }

    /**
     * Call the LLM, passing it the getWebSearchAgentPrompt and webToolsService tools.
     * Once the LLM is done calling the tools, return the complete response from the LLM.
     * @param prompt
     * @param originalAiFunctionContext
     */
    async handlePrompt(prompt: string, originalAiFunctionContext: AiFunctionContextV2){
        const subject = originalAiFunctionContext.inferenceSSESubject;
        const topicId = uuid();
        subject?.sendStatus({topicId, topic: 'web', displayText: `News Agent received prompt ${prompt}`});
        let openAiMessages: ChatCompletionMessageParam[] = [
            { role: 'system', content: this.getNewsAgentPrompt(prompt)},
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
        subject?.sendStatus({topicId, topic: 'web', displayText: `News Agent done.`, topicCompleted: true});
        return completeText;
    }

    getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
    }

}



