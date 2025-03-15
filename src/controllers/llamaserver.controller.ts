import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { exec } from 'child_process';
import * as os from 'os';
import {LoadModelRequest} from "../models/api/llamaServerModels";

// Define the request body DTO

@ApiTags('LlamaServerController')
@Controller('llamaServerController')
export class LlamaServerController {

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
        status: 500,
        description: 'Failed to start the model server',
    })
    @Post('loadModel')
    async loadModel(@Body() request: LoadModelRequest): Promise<{ success: boolean, message: string }> {
        try {
            // Kill any existing llama-server process
            const killCommand = os.platform() === 'win32'
                ? 'taskkill /F /IM llama-server.exe /T'
                : "pkill -f 'llama-server'";

            await this.executeCommand(killCommand);

            // Build the command based on the OS
            const isWindows = os.platform() === 'win32';

            let command: string;

            if (isWindows) {
                command = `.\\bin\\Release\\llama-server.exe`;
            } else {
                command = './bin/llama-server';
            }

            // Add parameters to the command
            command += ` -m "${request.modelPath}"`;
            command += ` -ngl ${request.ngl}`;
            command += ` --host ${request.host || '0.0.0.0'}`;
            command += ` --ctx-size ${request.contextSize}`;
            command += ` --n-predict ${request.nPredict}`;

            if (request.jinja) {
                command += ' --jinja';
            }

            // Command to open a new terminal and run the command
            let terminalCommand: string;

            if (isWindows) {
                terminalCommand = `start cmd.exe /K "${command}"`;
            } else {
                // For macOS or Linux
                terminalCommand = `osascript -e 'tell app "Terminal" to do script "${command}"'`;
            }

            // Execute the command
            await this.executeCommand(terminalCommand);

            return {
                success: true,
                message: 'Model server started successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to start model server: ${error.message}`
            };
        }
    }

    private executeCommand(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error && !error.message.includes('not found')) {
                    // Ignore "not found" errors when killing processes that might not exist
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
}