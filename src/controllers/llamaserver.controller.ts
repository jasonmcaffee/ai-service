import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { exec } from 'child_process';
import * as os from 'os';

// Define the request body DTO
export class LoadModelRequest {
    /**
     * Path to the model file
     * @example "C:\shared-drive\llm_models\Qwen2.5-7B-Instruct.Q6_K.gguf"
     */
    modelPath: string;

    /**
     * Number of GPU layers to use
     * @example 9999
     */
    ngl: number;

    /**
     * Host to bind the server to (optional)
     * @example "0.0.0.0"
     * @default "0.0.0.0"
     */
    host?: string = '0.0.0.0';

    /**
     * Context size
     * @example 60000
     */
    contextSize: number;

    /**
     * Number of tokens to predict
     * @example 10000
     */
    nPredict: number;

    /**
     * Enable Jinja templates for tool calling
     * @example true
     * @default false
     */
    jinja?: boolean = false;
}

@ApiTags('Model')
@Controller('model')
export class ModelController {

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