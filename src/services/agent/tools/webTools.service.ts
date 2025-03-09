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
    /**
     * Returns metadata describing the `searchWeb` function for OpenAI function calling.
     */
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
    async aiSearchWeb({query}: {query?: string} = {query: undefined}, context: AiFunctionContextV2, )
        : Promise<AiFunctionResult>{
        const statusId = uuid();
        const {inferenceSSESubject: subject} = context;

        const maxTokens = 50000;
        if(!query){
            throw new Error('searchWeb called without a query');
        }
        subject?.sendStatus({id: statusId, type: 'web', displayText: `Searching web with query: ${query}`, streamable: true});
        const maxPages=1, startPage=1;
        const searchResultResponse = await this.duckduckgoSearchService.searchDuckDuckGo(query, maxPages, startPage);

        const urls1 = searchResultResponse.searchResults.map(r => r.url);
        const urls = urls1;//urls1.slice(0, 1);

        subject?.sendStatus({id: statusId, type: 'web', displayText: `Retrieving contents of ${urls.length} urls from search result`, data: {urls}, streamable: true});
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
            subject?.sendStatus({id: statusId, type:'web', isError: true, displayText: `failed getting page contents of url: ${failureResult.url} due to error: ${failureResult.error.message}`, streamable: true});
            console.warn(`failed getting page contents of url: ${failureResult.url}`, failureResult.error);
        }
        subject?.sendStatus({type: 'web', displayText: `Retrieved ${result.searchResults.length} pages, with a total of ${totalTokens} tokens.`, streamable: true, streamingComplete: true});
        //set a maximum token length.
        return { result, context,};
    }

    getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
    }

}
