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
    async streamInference(@Query('query') query: string, ) {
        const memberId = this.authenticationService.getMemberId();
        return this.websearchService.searchDuckDuckGo(query);
    }

}
