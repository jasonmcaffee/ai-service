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
                    // maxPages: {
                    //     type: "integer",
                    //     description: "The maximum number of pages to fetch.",
                    //     default: 1,
                    // },
                    // startPage: {
                    //     type: "integer",
                    //     description: "The page number to start the search from.",
                    //     default: 1,
                    // },
                },
                required: ["query"],
            },
        };
    }
    async searchWeb(query: string, maxPages=1, startPage=1): Promise<SearchResultResponse>{
        const searchResultResponse = await this.duckduckgoSearchService.searchDuckDuckGo(query, maxPages, startPage);
        return searchResultResponse;
    }
}