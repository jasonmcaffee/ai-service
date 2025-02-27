import {Injectable} from "@nestjs/common";
import {DuckduckgoSearchService} from "./duckduckgoSearch.service";
import {SearchResultResponse} from "../models/api/conversationApiModels";

@Injectable()
export class LlmToolsService{
    constructor(private readonly duckduckgoSearchService: DuckduckgoSearchService) {}
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
    async searchWeb({query}: {query?: string} = {query: undefined}): Promise<SearchResultResponse>{
        if(!query){
            throw new Error('searchWeb called without a query');
        }
        const maxPages=1, startPage=1;
        const searchResultResponse = await this.duckduckgoSearchService.searchDuckDuckGo(query, maxPages, startPage);

        //set a maximum token length.
        return searchResultResponse;
    }

    async searchWebStub(query: string): Promise<SearchResultResponse>{
        if(!query){
            throw new Error('searchWeb called without a query');
        }
        return {
            query,
            searchResults: [
                {
                    url: 'http://jasonnews.com',
                    title: 'Latest news',
                    blurb: 'A cat ran over a hamster on his way to visit his grandmother.'
                }
            ]
        }
    }
}
