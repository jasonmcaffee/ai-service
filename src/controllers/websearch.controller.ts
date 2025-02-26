import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthenticationService } from '../services/authentication.service';
import {WebsearchService} from "../services/websearch.service";
import { GetPageContentsResponse, SearchResultResponse } from '../models/api/conversationApiModels';

@ApiTags('WebSearch')
@Controller('webSearch')
export class WebsearchController {
    constructor(private readonly websearchService: WebsearchService, private readonly authenticationService: AuthenticationService) {}

    @ApiOperation({ summary: 'search the web' })
    @ApiQuery({ name: 'query', type: String, description: 'search terms' })
    @ApiQuery({ name: 'startingPage', type: Number, description: 'page to start on. e.g. 1' })
    @ApiQuery({ name: 'maxPages', type: Number, description: 'number of pages to retrieve.' })
    @Get('search')
    @ApiResponse({status: 200, description: 'Successful response', type: SearchResultResponse})
    async webSearch(@Query('query') query: string, @Query('startingPage') startingPage: number, @Query('maxPages') maxPages: number) {
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.search(query, maxPages, startingPage);
    }

    @ApiOperation({ summary: 'Stream a message based on a prompt' })
    @ApiQuery({ name: 'query', type: String, description: 'Search query' })
    @ApiQuery({ name: 'startingPage', type: Number, description: 'page to start on. e.g. 1' })
    @ApiQuery({ name: 'maxPages', type: Number, description: 'number of pages to retrieve.' })
    @Get('streamWebSearch') // Must be GET for EventSource to work
    @Sse() // Server-Sent Events so we can stream LLM response back the client.
    @ApiResponse({
        status: 200,
        description: 'Successful response',
        content: {
            'text/event-stream': {
                schema: {
                    type: 'string',
                    example:
                      `data: { 
                        "searchResults": [{
                            "url": "http://example.com",
                            "title": "Example dot com",
                            "blurb": "Some example stuff",
                        }], 
                        "end": "true" 
                      }`, //end is true when response is complete.
                },
            },
        },
    })
    async streamWebSearch(@Query('query') query: string, @Query('startingPage') startingPage: number, @Query('maxPages') maxPages: number) {
        console.log('got stream web search request: ', query);
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.streamSearch(query, maxPages, startingPage);
    }

    @ApiOperation({ summary: 'fetch the contents of the page.' })
    @ApiQuery({ name: 'url', type: String, description: 'url to fetch' })
    @Get('getPageContents')
    @ApiResponse({status: 200, description: 'Successful response', type: GetPageContentsResponse})
    async getPageContents(@Query('url') url: string, ) {
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.getMarkdownAndTokenCountsForUrlForAiUse(url);
    }

    @ApiOperation({ summary: 'Stream a summary based on url' })
    @ApiQuery({ name: 'url', type: String, description: 'Url to summarize' })
    @ApiQuery({ name: 'searchQueryContext', type: String, description: 'context in which the url was originally fetched' , required:false})
    @Get('streamSummarizeUrl') // Must be GET for EventSource to work
    @Sse() // Server-Sent Events so we can stream LLM response back the client.
    @ApiResponse({
        status: 200,
        description: 'Successful response',
        content: {
            'text/event-stream': {
                schema: {
                    type: 'string',
                    example: 'data: { "text": "response", "end": "true" }', //end is true when response is complete.
                },
            },
        },
    })
    async streamSummarizeUrl(@Query('url') url: string, @Query('searchQueryContext') searchQueryContext?: string,){
        const memberId = this.authenticationService.getMemberId();
        console.log(`streamSummarizeUrl for ${searchQueryContext}`);
        return this.websearchService.streamAiSummaryOfUrl(memberId, url, searchQueryContext);
    }

    @ApiOperation({summary: 'stop the current stream for a member'})
    @Get('stopSummarizingUrl')
    @ApiResponse({status: 201})
    async stopSummarizingUrl(){
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.stop(memberId);
    }

}
