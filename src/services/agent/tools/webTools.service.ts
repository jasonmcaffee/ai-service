import {Injectable} from "@nestjs/common";
import {DuckduckgoSearchService} from "../../duckduckgoSearch.service";
import { SearchResultResponse, SearchResultWithMarkdownContentResponse } from '../../../models/api/conversationApiModels';
import { PageScraperService } from '../../pageScraper.service';
import { getWordAndTokenCount, uuid } from '../../../utils/utils';
import InferenceSSESubject from "../../../models/InferenceSSESubject";
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult, } from '../../../models/agent/aiTypes';
import { chatCompletionTool, extractChatCompletionToolAnnotationValues } from './aiToolAnnotations';

@Injectable()
export class WebToolsService implements AiFunctionExecutor<WebToolsService>{
    constructor(private readonly duckduckgoSearchService: DuckduckgoSearchService,
                private readonly pageScraperService: PageScraperService) {}

    @chatCompletionTool({
        type: "function",
        function: {
            name: 'aiGetContentsOfWebPageAsMarkdown',
            description: `Retrieves the contents of a web page, as markdown, via url so that an AI agent can do things like summarize, read, etc.
            Returns the contents of the page as markdown.
            `,
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "The url to use in order to get the contents of a webpage as markdown.  Urls must begin with http or https e.g. https://wikipedia.com",
                    }
                }
            }
        }
    })
    async aiGetContentsOfWebPageAsMarkdown({url}: {url?: string} = {url: undefined}, context: AiFunctionContextV2, ): Promise<AiFunctionResult>{
        if(!url){ throw new Error('no url provided to aiGetContentsOfWebPage'); }
        const topicId = uuid();
        const {inferenceSSESubject: subject} = context;
        subject?.sendStatus({topicId, topic: 'web', displayText: `Page scraper is getting contents of url: ${url}`});
        try {
            const { markdown } = await this.pageScraperService.getContentsOfWebpageAsMarkdown({url: url, removeScriptsAndStyles: true, shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true, });
            const {tokenCount} = getWordAndTokenCount(markdown);
            subject?.sendStatus({topicId, topic: 'web', displayText: `Page scraper is done getting contents of url. Token count: ${tokenCount}`, topicCompleted: true});
            return {result: markdown, context};
        }catch(e){
            subject?.sendStatus({topicId, topic: 'web', displayText: `Page scraper encountered error when fetching url: ${url}: ${e.message}`, topicCompleted: true});
            throw e;
        }

    }

    @chatCompletionTool({
        type: "function",
        function: {
            name: "aiSearchWeb",
            description: `Search the web using DuckDuckGo and return relevant results.  
            Returns results in the format: 
            {
                query: "latest news",
                searchResults: [
                    { title: "CNN headlines", url: "http://cnn.com", blurb: "Get your latest news", markdown: "Contents of the page in markdown format"}
                ]
            }
            `,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query string.",
                    },
                },
                required: ["query"],
            },
        }
    })
    async aiSearchWeb({query}: {query?: string} = {query: undefined}, context: AiFunctionContextV2, ): Promise<AiFunctionResult>{
        const topicId = uuid();
        const {inferenceSSESubject: subject} = context;

        const maxTokens = 50000;
        if(!query){
            throw new Error('searchWeb called without a query');
        }
        subject?.sendStatus({topicId, topic: 'web', displayText: `Searching web with query: ${query}`});
        const maxPages=1, startPage=1;
        const searchResultResponse = await this.duckduckgoSearchService.searchDuckDuckGo(query, maxPages, startPage);

        const urls1 = searchResultResponse.searchResults.map(r => r.url);
        const urls = urls1;//urls1.slice(0, 1);
        const webUrls = searchResultResponse.searchResults.map(r => { return {title: r.title, url: r.url, blurb: r.blurb}; });

        subject?.sendStatus({topicId, topic: 'web', displayText: `Retrieving contents of ${urls.length} urls from search result`, data: {webUrls}, });
        //fetch all pages in the results
        const markdownContentsForAllPagesInTheSearchResults = await this.pageScraperService.getContentsOfWebpagesAsMarkdown(
          {urls, removeScriptsAndStyles: true, shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true, });

        //build a new result
        const result = new SearchResultWithMarkdownContentResponse();
        result.query = query;
        result.searchResults = [];
        let totalTokens = 0;
        for (let markdownResponse of markdownContentsForAllPagesInTheSearchResults.successResults){
            const {url, markdown} = markdownResponse;
            const {tokenCount} = getWordAndTokenCount(markdown);
            if( (totalTokens + tokenCount) > maxTokens){
                console.warn(`search results totalTokens: ${totalTokens} + tokenCount: ${tokenCount} exceeded max tokens of ${maxTokens}`);
                continue; //try to get more if we can..?
            }
            totalTokens += tokenCount;
            const correspondingSearchResultForUrl = searchResultResponse.searchResults.find(s => s.url == url)!; //todo: could be the same url twice?  probably not...
            // result.searchResults.push({...correspondingSearchResultForUrl, markdown});
            result.searchResults.push({...correspondingSearchResultForUrl, markdown: ''});
        }

        for(let failureResult of markdownContentsForAllPagesInTheSearchResults.errorResults){
            subject?.sendStatus({topicId, topic:'web', isError: true, displayText: `failed getting page contents of url: ${failureResult.url} due to error: ${failureResult.error.message}`});
            console.warn(`failed getting page contents of url: ${failureResult.url}`, failureResult.error);
        }
        subject?.sendStatus({topicId, topic: 'web', displayText: `Retrieved ${result.searchResults.length} pages, with a total of ${totalTokens} tokens.`, topicCompleted: true});
        //set a maximum token length.
        return { result, context,};
    }

    // @chatCompletionTool({
    //     type: "function",
    //     function: {
    //         name: "aiAskAgentToEvaluateResultsSoFarAndCreateNewPlan",
    //         description: `
    //     There are some scenarios where a plan cannot be fully created for a user prompt, without there being a step for an AI to process the results so far, then create a sub plan to continue processing.
    //     Deeply consider and reason about the implications of having such a powerful function/tool.
    //     This enables you to break work up into phases, where subsequent phases could be creating a new plan.
    //
    //     # Example Usage
    //     e.g. If the user prompt is "create a list of random numbers, then take the first three numbers and add 8 to each one",
    //     a plan might have steps:
    //     aiAddFunctionStepToPlan - { functionName: "aiGenerateRandomNumbers" }
    //     aiAddFunctionStepToPlan - { functionName: "aiAskAgentToEvaluateResultsSoFarAndCreateNewPlan", functionArgs: {prompt: "add 8 to each of the numbers in this list: $aiGenerateRandomNumbers.result" }
    //   `,
    //         parameters: {
    //             type: "object",
    //             properties: {
    //                 prompt: {
    //                     type: "string",
    //                     description: `The clear and descriptive instructions to give to the LLM Agent.`
    //                 },
    //                 reasoning: {
    //                     type: "string",
    //                     description: "The reason you feel this step is needed.  e.g. Current tool X requires a single number, which must be evaluated by an agent first"
    //                 }
    //             }
    //         }
    //     }
    // })
    // async aiAskAgentToEvaluateResultsSoFarAndCreateNewPlan({prompt, reasoning}: {prompt: string, reasoning: string}, context: AiFunctionContextV2): Promise<AiFunctionResult> {
    //     console.log(`aiAskAgentToEvaluateResultsSoFarAndCreateNewPlan called with prompt: ${prompt},reasoning: ${reasoning}`);
    //     return {result: true, context};
    // }

    getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
    }

}
