import {Injectable} from "@nestjs/common";
import {DuckduckgoSearchService} from "./duckduckgoSearch.service";
import { SearchResultResponse, SearchResultWithMarkdownContentResponse } from '../models/api/conversationApiModels';
import { PageScraperService } from './pageScraper.service';
import { getWordAndTokenCount } from '../utils/utils';

@Injectable()
export class LlmToolsService{
    constructor(private readonly duckduckgoSearchService: DuckduckgoSearchService,
                private readonly pageScraperService: PageScraperService) {}
    /**
     * Returns metadata describing the `searchWeb` function for OpenAI function calling.
     */
    static getSearchWebOpenAIMetadata() {
        return {
            name: "searchWeb",
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
        };
    }
    async searchWeb({query}: {query?: string} = {query: undefined}): Promise<SearchResultWithMarkdownContentResponse>{
        const maxTokens = 50000;
        if(!query){
            throw new Error('searchWeb called without a query');
        }
        const maxPages=1, startPage=1;
        const searchResultResponse = await this.duckduckgoSearchService.searchDuckDuckGo(query, maxPages, startPage);

        const urls1 = searchResultResponse.searchResults.map(r => r.url);
        const urls = urls1;//urls1.slice(0, 5);

        //fetch all pages in the results
        const markdownContentsForAllPagesInTheSearchResults = await this.pageScraperService.getContentsOfWebpagesAsMarkdown(
          {urls, removeScriptsAndStyles: true, shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true, });

        //build a new result
        const result = new SearchResultWithMarkdownContentResponse();
        result.query = query;
        result.searchResults = [];
        let totalTokens = 0;
        for (let markdownResponse of markdownContentsForAllPagesInTheSearchResults){
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
        //set a maximum token length.
        return result;
    }

}
