import { Controller, Post, Body, BadRequestException, Query, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { LoadModelRequest } from "../models/api/llamaServerModels";
import {LlamaCppService} from "../services/llamacpp.service";
import { LlamaCppModelsResponse } from '../models/api/conversationApiModels';

@ApiTags('LlamaServerController')
@Controller('llamaServerController')
export class LlamaServerController {

    constructor(private readonly llamaServerService: LlamaCppService,) {}
    @ApiOperation({ summary: 'Load and start the LLM model server' })
    @ApiBody({
        description: 'The model configuration parameters',
        type: LoadModelRequest,
    })
    @ApiResponse({
        status: 200,
        description: 'The model server has been successfully started',
    })
    @ApiResponse({
        status: 400,
        description: 'Failed to start the model server',
    })
    @Post('loadModel')
    async loadModel(@Body() request: LoadModelRequest): Promise<{ success: boolean, message: string }> {
        return this.llamaServerService.loadModel(request);
    }

    @ApiOperation({summary: "get currently running model information"})
    @ApiQuery({name: "url", type: String, required: true, description: 'url of the llama cpp server'})
    @Get('currentlyRunningModel')
    @ApiResponse({type: LlamaCppModelsResponse})
    async getCurrentlyRunningModel(@Query("url") url: string): Promise<LlamaCppModelsResponse>{
        return this.llamaServerService.getCurrentlyRunningModel(url)
    }
}
