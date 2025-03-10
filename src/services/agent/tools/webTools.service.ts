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
            name: 'aiGetContentsOfWebPage',
            description: 'Retrieves the contents of a web page via url so that an AI agent can do things like summarize, read, etc',
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "The url to use in order to get the contents of a webpage. e.g. wikipedia.com",
                    }
                }
            }
        }
    })
    async aiGetContentsOfWebPage({url}: {url?: string} = {url: undefined}, context: AiFunctionContextV2, ): Promise<AiFunctionResult>{
        if(!url){ throw new Error('no url provided to aiGetContentsOfWebPage'); }
        const topicId = uuid();
        const {inferenceSSESubject: subject} = context;
        subject?.sendStatus({topicId, topic: 'web', displayText: `Getting contents of url: ${url}`});
        const { markdown } = await this.pageScraperService.getContentsOfWebpageAsMarkdown({url: url, removeScriptsAndStyles: true, shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true, });
        const {tokenCount} = getWordAndTokenCount(markdown);
        subject?.sendStatus({topicId, topic: 'web', displayText: `Done getting contents of url. Token count: ${tokenCount}`});
        return {result: markdown, context};
    }

    @chatCompletionTool({
        type: "function",
        function: {
            name: "aiSearchWeb",
            description: "Search the web using DuckDuckGo and return relevant results.",
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
            result.searchResults.push({...correspondingSearchResultForUrl, markdown});
        }

        for(let failureResult of markdownContentsForAllPagesInTheSearchResults.errorResults){
            subject?.sendStatus({topicId, topic:'web', isError: true, displayText: `failed getting page contents of url: ${failureResult.url} due to error: ${failureResult.error.message}`});
            console.warn(`failed getting page contents of url: ${failureResult.url}`, failureResult.error);
        }
        subject?.sendStatus({topicId, topic: 'web', displayText: `Retrieved ${result.searchResults.length} pages, with a total of ${totalTokens} tokens.`, topicCompleted: true});
        //set a maximum token length.
        return { result, context,};
    }

    getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
    }

}
