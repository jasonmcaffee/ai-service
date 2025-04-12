import { Injectable } from '@nestjs/common';
import { WebToolsService } from '../tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../../openAiWrapperV2.service';
import {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import { createOpenAIMessagesFromMessages, uuid, withStatus } from '../../../utils/utils';
import {AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult} from '../../../models/agent/aiTypes';
import { Model } from '../../../models/api/conversationApiModels';
import {chatCompletionTool, extractChatCompletionToolAnnotationValues} from "../tools/aiToolAnnotations";
import { PageScraperService } from '../../pageScraper.service';

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
        private readonly openAiWrapperService: OpenaiWrapperServiceV2,
        private readonly pageScraperService: PageScraperService,
    ) {}

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

    private getNewsAgentPrompt(newsSitesInPromptFormat: string){
        return `
      You are an AI agent who is an expert at parsing the markdown from news sites, in order to create concise news reporting.
      You expertly consolidate the information from multiple news websites into a single document, following the instruction given in the user's prompt.
      
      # Information to Reference
      When responding, you should only reference the information found in the below information tag, and nothing else.  
      Do not use any previous knowledge of topics, regardless of what is asked.
      The information tag contain 1 or more <newsSite> entries, which each include a url and the website in markdown format.
      <information>
      ${newsSitesInPromptFormat}
      </information>
      
      # Response Instructions
      Do not use any preamble in your response.
      Do not ask followup questions.
      You should respond with headlines, summaries, and sources.
      Your response should contain headlines in the same order that they were found in the markdown for the news site.
      This is important because the most important headlines are found at the top of the markdown.
      Your response should include at least 20 headlines.
      
      # Response Format
      Your response should be formatted in markdown.
      Each headline should be formatted as header (ie. #). 
      Under each headline should be a summary of all the information you found related to the headline.
      Under the summary, a list of sources should be provided, with url links to the article for the headline.
      You should include a source from each newsSite provided.
      
      Each source must include the link to the headline.  The relavent link will begin with http://local.ai
      
      ## Example Response
      Important: Your response should be in the same format as provided below. 
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
      
      # IMPORTANT CONSIDERATIONS
      Never use any knowledge or information that is not directly mentioned in the provided news articles.  
      If the user prompt relates to information not found in the news articles, simply state that you could not find any related information in the news.
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
        return withStatus(async ()=> {
            const newsSitesInPromptFormat = await getNewsSitesAsMarkdownInPromptFormat(this.pageScraperService);
            let openAiMessages: ChatCompletionMessageParam[] = [
                { role: 'system', content: this.getNewsAgentPrompt(newsSitesInPromptFormat)},
                { role: 'user', content: prompt},
            ];
            const aiFunctionContext = {...originalAiFunctionContext, aiFunctionExecutor: undefined};
            aiFunctionContext.aiFunctionExecutor = undefined;
            const { completeText } = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
                openAiMessages, model: originalAiFunctionContext.model!, aiFunctionContext,
            });
            console.log(`news agent response: `, completeText);
            return completeText;
        }, {context: originalAiFunctionContext, displayText: `News Agent handling "${prompt}"`, topic: 'agent'});

    }

    getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
    }

}

async function getNewsSitesAsMarkdownInPromptFormat(pageScraperService: PageScraperService){
    const urls = [
      'https://cnn.com',
      'https://www.npr.org',
      'https://foxnews.com',
      'https://bbc.com',
    ];
    const {successResults, errorResults} = await pageScraperService.getContentsOfWebpagesAsMarkdown({urls, removeImages: true, removeNavElements: true, cleanWikipedia: true, shortenUrls: true, removeScriptsAndStyles: true});
    const successResultsInPromptFormat = convertMarkdownResultsIntoPromptFormat(successResults);
    return successResultsInPromptFormat;
}

function convertMarkdownResultsIntoPromptFormat(successResults: {url: string, markdown: string}[]){
    const promptFormat = successResults.map(({url, markdown}) => {
        return `
         <newsSite>
            <url>${url}</url>
            <siteContentsAsMarkdown>${markdown}</siteContentsAsMarkdown>
         </newsSite>
        `
    }).join('\n');
    return promptFormat;
}

