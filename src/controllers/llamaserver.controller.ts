import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { exec, spawn } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { LoadModelRequest } from "../models/api/llamaServerModels";
import {LlamaCppService} from "../services/llamacpp.service";

@ApiTags('LlamaServerController')
@Controller('llamaServerController')
export class LlamaServerController {
    private serverProcessId: number | null = null;
    private logFilePath = path.join(process.cwd(), 'llama_server_output.log');
    private pidFilePath = path.join(process.cwd(), 'llama_server_pid.txt');
    private isWindows = os.platform() === 'win32';

    constructor(private readonly llamaServerService: LlamaCppService,) {
    }
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
}