import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthenticationService } from '../services/authentication.service';
import {WebsearchService} from "../services/websearch.service";
import {SearchResultResponse} from "../models/api/conversationApiModels";

@ApiTags('WebSearch')
@Controller('webSearch')
export class WebsearchController {
    constructor(private readonly websearchService: WebsearchService, private readonly authenticationService: AuthenticationService) {}

    @ApiOperation({ summary: 'search the web' })
    @ApiQuery({ name: 'query', type: String, description: 'search terms' })
    @Get('search')
    @ApiResponse({status: 200, description: 'Successful response', type: SearchResultResponse})
    async webSearch(@Query('query') query: string, ) {
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.search(query);
    }

    @ApiOperation({ summary: 'Stream a message based on a prompt' })
    @ApiQuery({ name: 'query', type: String, description: 'Search query' })
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
    async streamWebSearch(@Query('query') query: string,) {
        console.log('got stream web search request: ', query);
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.streamSearch(query);
    }

    @ApiOperation({ summary: 'fetch the contents of the page.' })
    @ApiQuery({ name: 'url', type: String, description: 'url to fetch' })
    @Get('getPageContents')
    @ApiResponse({status: 200, description: 'Successful response', type: String})
    async getPageContents(@Query('url') url: string, ) {
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.getMarkdownContentsOfPage(url);
    }



}
