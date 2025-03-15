import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { exec, spawn } from 'child_process';
import * as os from 'os';
import {LoadModelRequest} from "../models/api/llamaServerModels";

@ApiTags('LlamaServerController')
@Controller('llamaServerController')
export class LlamaServerController {
    private serverProcess: any = null;
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
            await this.killExistingProcess();

            // Build the command based on the OS
            const isWindows = os.platform() === 'win32';

            let executable: string;

            if (isWindows) {
                executable = `C:\\shared-drive\\dev\\llama.cpp-v3\\build\\bin\\Release\\llama-server.exe`;
            } else {
                executable = './bin/llama-server';
            }

            // Add parameters to the command

            request.ngl = request.ngl || 9999;
            request.contextSize = request.contextSize || 60000;
            request.nPredict = request.nPredict || 10000;
            const args: string[] = [
                '-m', request.modelPath!,
                '-ngl', request.ngl.toString(),
                '--host', request.host || '0.0.0.0',
                '--ctx-size', request.contextSize.toString(),
                '--n-predict', request.nPredict.toString()
            ];

            if (request.jinja) {
                args.push('--jinja');
            }

            const result = await this.executeCommandWithTimeout(executable, args, 90000);

            return {
                success: true,
                message: 'Model server started successfully'
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException({
                success: false,
                message: `Failed to start model server: ${error.message}`,
                error: error.output || error.message
            });
        }
    }

    private async killExistingProcess(): Promise<void> {
        return new Promise((resolve) => {
            // Kill any existing process we might have stored
            if (this.serverProcess) {
                try {
                    this.serverProcess.kill('SIGTERM');
                } catch (e) {
                    // Ignore errors when killing the process
                }
                this.serverProcess = null;
            }

            // Also attempt to kill any other llama-server processes
            const killCommand = os.platform() === 'win32'
                ? 'taskkill /F /IM llama-server.exe /T'
                : "pkill -f 'llama-server'";

            exec(killCommand, () => {
                // Resolve regardless of outcome (process might not exist)
                resolve();
            });
        });
    }

    private executeCommandWithTimeout(cmd: string, args: string[], timeoutMs: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let output = '';
            let hasStarted = false;

            // Start the process
            const process = spawn(cmd, args, {
                shell: true,
                windowsHide: false
            });

            // Store the process so we can kill it later if needed
            this.serverProcess = process;

            // Listen for data from stdout
            process.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                console.log('output from stdout: ', output);
                // Check if the server has started successfully
                if (chunk.includes('server is listening on http://') &&
                    chunk.includes('starting the main loop')) {
                    hasStarted = true;
                    resolve();
                }
            });

            // Listen for data from stderr
            process.stderr.on('data', (data) => {
                output += data.toString();
                console.log('output from stderr: ', output);
                // Check if the server has started successfully
                if (output.includes('server is listening on http://') &&
                    output.includes('starting the main loop')) {
                    hasStarted = true;
                    resolve();
                }
            });

            // Handle process exit
            process.on('close', (code) => {
                if (!hasStarted) {
                    reject({
                        message: `Process exited with code ${code}`,
                        output
                    });
                }
            });

            // Handle process errors
            process.on('error', (err) => {
                reject({
                    message: `Failed to start process: ${err.message}`,
                    output
                });
            });

            // Set timeout
            const timeout = setTimeout(() => {
                if (!hasStarted) {
                    // Kill the process if it hasn't started in time
                    try {
                        process.kill('SIGTERM');
                    } catch (e) {
                        // Ignore errors when killing the process
                    }
                    reject({
                        message: 'Timeout: Server did not start within 90 seconds',
                        output
                    });
                }
            }, timeoutMs);

            // Clear timeout when resolved or rejected
            process.on('close', () => clearTimeout(timeout));
        });
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