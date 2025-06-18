import {BadRequestException, Body, Injectable} from "@nestjs/common";
import {LoadModelRequest} from "../models/api/llamaServerModels";
import * as fs from 'fs';
import * as path from 'path';
import {exec, spawn} from "child_process";
import * as os from 'os';
import { LlamaCppModelsResponse } from '../models/api/conversationApiModels';

const checkForServerStartInLogFilePathEveryNms = 50;

@Injectable()
export class LlamaCppService {
    private serverProcessId: number | null = null;
    private logFilePath = path.join(process.cwd(), 'llama_server_output.log');
    private pidFilePath = path.join(process.cwd(), 'llama_server_pid.txt');
    private isWindows = os.platform() === 'win32';
    private readonly llamaServerExePath = `C:\\jason\\dev\\llama.cpp-v3\\build\\bin\\Release\\llama-server.exe`
    constructor() {}


    async getCurrentlyRunningModel(llamaCppBaseUrl="http://192.168.0.157:8080"): Promise<LlamaCppModelsResponse>{
        const url = `${llamaCppBaseUrl}/v1/models`;

        try{
            const result = await fetch(url);
            if(!result.ok){
                throw new Error(`could not connect to url ${url} to get model data`);
            }
            const json = await result.json();
            const llamaCppModelsResponse = json as LlamaCppModelsResponse;
            return llamaCppModelsResponse;
        }catch(e){
            throw new Error(`error getting model data from llama.cpp: ${e.message}`);
        }
    }

    async loadModel(request: LoadModelRequest): Promise<{ success: boolean, message: string }> {
        try {
            // Ensure any existing processes are killed
            await this.killExistingProcesses();

            // Wait a moment to ensure file handles are released
            await new Promise(resolve => setTimeout(resolve, 1000));

            this.deleteAndCreateLogFile();

            // Build the command based on the OS
            let executable: string;
            if (this.isWindows) {
                executable = this.llamaServerExePath;
            } else {
                executable = './bin/llama-server';
            }
            // Set default values if not provided
            // request.ngl = request.ngl || 9999;
            // request.contextSize = request.contextSize || 60000;
            // request.nPredict = request.nPredict || 10000;
            // let command = `"${executable}" -m "${request.modelPath}" -ngl ${request.ngl} --host ${request.host || '0.0.0.0'} --ctx-size ${request.contextSize} --n-predict ${request.nPredict}`;
            let commandParts = [
                `"${executable}"`,
                `-m "${request.modelPath}"`,
                request.ngl != null ? `-ngl ${request.ngl}` : '-ngl 9999',
                request.host ? `--host ${request.host}` : `--host 0.0.0.0`,
                request.contextSize != null ? `--ctx-size ${request.contextSize}` : null,
                // request.nPredict != null ? `--n-predict ${request.nPredict}` : null
            ];

            let command = commandParts.filter(Boolean).join(" ");
            if (request.jinja) {
                command += ' --jinja';
            }

            command += ` ${request.additionalLlamacppServerParams ?? ''}`;

            // Launch server in new terminal and wait for startup
            await this.startServerInNewTerminal(command, 90000);

            return {
                success: true,
                message: 'Model server started successfully'
            };
        } catch (error) {
            // Make sure to kill any processes if we had an error
            await this.killExistingProcesses();

            throw new BadRequestException({
                success: false,
                message: `Failed to start model server: ${error.message}`,
                error: error.output || error.message
            });
        }
    }

    private deleteAndCreateLogFile() {
        // Try to delete the log file if it exists
        try {
            if (fs.existsSync(this.logFilePath)) {
                fs.unlinkSync(this.logFilePath);
            }
        } catch (error) {
            console.log(`Failed to delete log file: ${error.message}`);
            // Continue even if we couldn't delete the file
        }
    }

    private async killExistingProcesses(): Promise<void> {
        console.log('Killing existing processes...');

        const killPromises: Promise<string | void>[] = [];

        // Kill process by stored ID if we have one
        if (this.serverProcessId) {
            try {
                console.log(`Killing process with ID: ${this.serverProcessId}`);
                if (this.isWindows) {
                    killPromises.push(this.executeCommand(`taskkill /F /PID ${this.serverProcessId}`));
                } else {
                    killPromises.push(this.executeCommand(`kill -9 ${this.serverProcessId}`));
                }
            } catch (e) {
                console.log('Error killing process by ID:', e);
            }
            this.serverProcessId = null;
        }

        // Try to get PID from file if it exists
        try {
            if (fs.existsSync(this.pidFilePath)) {
                const pidContent = fs.readFileSync(this.pidFilePath, 'utf8').trim();
                const pid = parseInt(pidContent, 10);
                if (pid && !isNaN(pid)) {
                    console.log(`Found PID ${pid} in file, killing it`);
                    if (this.isWindows) {
                        killPromises.push(this.executeCommand(`taskkill /F /PID ${pid}`).catch(e => console.log(`Error killing PID ${pid}: ${e.message}`)));
                    } else {
                        killPromises.push(this.executeCommand(`kill -9 ${pid}`).catch(e => console.log(`Error killing PID ${pid}: ${e.message}`)));
                    }
                }

                // Delete PID file
                try {
                    fs.unlinkSync(this.pidFilePath);
                } catch (e) {
                    console.log(`Could not delete PID file: ${e.message}`);
                }
            }
        } catch (e) {
            console.log(`Error reading PID file: ${e.message}`);
        }

        // Also kill any llama-server processes
        if (this.isWindows) {
            // Windows uses taskkill to force terminate all instances
            killPromises.push(this.executeCommand('taskkill /F /IM llama-server.exe /T').catch(e => console.log('No existing llama-server.exe processes found')));
        } else {
            // Unix uses pkill
            killPromises.push(this.executeCommand("pkill -f 'llama-server'").catch(e => console.log('No existing llama-server processes found')));
        }

        // Wait for all kill commands to complete
        await Promise.all(killPromises);
        console.log('Process killing completed');
    }

    private async startServerInNewTerminal(command: string, timeoutMs: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const tempScriptPath = this.isWindows
                ? path.join(process.cwd(), 'llama_launcher.bat')
                : path.join(process.cwd(), 'llama_launcher.sh');

            console.log('Creating launcher script at:', tempScriptPath);

            // Create script content based on platform - don't redirect output to keep it visible in terminal
            let scriptContent;
            if (this.isWindows) {
                // Windows batch script that uses PowerShell's Tee-Object
                scriptContent = `@echo off\r\n`;
                scriptContent += `echo Starting llama-server...\r\n\r\n`;

                // Save the current Command Processor PID to the PID file
                scriptContent += `echo %PROCESS_ID%>${this.pidFilePath}\r\n\r\n`;

                // Use PowerShell to run the command and tee the output
                // The -NoExit flag keeps PowerShell window open
                // scriptContent += `powershell -NoExit -Command "& {${command} | Tee-Object -FilePath '${this.logFilePath}'}" \r\n`;
                scriptContent += `powershell -NoExit -Command "& { & ${command} 2>&1 | Tee-Object -FilePath '${this.logFilePath}' }" \r\n`
            } else {
                // Bash script for macOS/Linux
                scriptContent = `#!/bin/bash\n`;
                scriptContent += `echo $$ > ${this.pidFilePath}\n`;
                scriptContent += `echo "Starting llama-server..."\n`;
                scriptContent += `${command} | tee ${this.logFilePath}\n`;
            }

            // Write the script file
            fs.writeFileSync(tempScriptPath, scriptContent);

            if (!this.isWindows) {
                // Make the script executable on Unix systems
                exec(`chmod +x ${tempScriptPath}`);
            }

            // Launch in a new terminal window
            let terminalProcess;
            if (this.isWindows) {
                console.log('Starting Windows terminal...');
                // For Windows, we launch the script directly without cmd.exe wrapper
                // since we're using PowerShell in the script
                terminalProcess = spawn('cmd.exe', ['/c', 'start', tempScriptPath], {
                    detached: true,
                    stdio: 'ignore',
                    shell: true
                });
            } else {
                console.log('Starting macOS terminal...');
                terminalProcess = spawn('osascript', [
                    '-e',
                    `tell app "Terminal" to do script "${tempScriptPath}"`
                ], {
                    detached: true,
                    stdio: 'ignore'
                });
            }

            // Check if log file exists and create a watcher
            console.log('Setting up log file monitoring...');
            let checkInterval: NodeJS.Timeout | null = null;
            let timeoutId: NodeJS.Timeout | null = null;
            let failedChecks = 0;
            let hasStarted = false;

            // Function to read and check log file
            const checkLogFile = () => {
                try {
                    if (!fs.existsSync(this.logFilePath)) {
                        failedChecks++;
                        console.log(`Log file does not exist yet... (${failedChecks})`);

                        // After several checks, try creating an empty log file
                        if (failedChecks > 10) {
                            console.log('Trying to create log file directly...');
                            try {
                                fs.writeFileSync(this.logFilePath, 'Waiting for server output...\r\n', { flag: 'w' });
                            } catch (err) {
                                console.log(`Failed to create empty log file: ${err.message}`);
                            }
                        }
                        return;
                    }

                    failedChecks = 0;
                    // const content = fs.readFileSync(this.logFilePath, 'utf8');
                    let content = fs.readFileSync(this.logFilePath, 'utf16le').trim();
                    // console.log(`content from log file: `, content);
                    // Check for successful start
                    if (content.indexOf('server is listening on http://') > 0) {
                        console.log('Found success message in logs!');
                        hasStarted = true;

                        // Try to get process ID from file
                        try {
                            if (fs.existsSync(this.pidFilePath)) {
                                const pidContent = fs.readFileSync(this.pidFilePath, 'utf8').trim();
                                this.serverProcessId = parseInt(pidContent, 10);
                                console.log(`Stored server process ID: ${this.serverProcessId}`);
                            }
                        } catch (e) {
                            console.log('Could not read process ID file:', e);
                        }

                        // Clean up
                        if (checkInterval) clearInterval(checkInterval);
                        if (timeoutId) clearTimeout(timeoutId);

                        resolve();
                    }
                } catch (err) {
                    console.log('Error reading log file:', err);
                }
            };

            // Check file every 500ms
            checkInterval = setInterval(checkLogFile, checkForServerStartInLogFilePathEveryNms);

            // Set timeout
            timeoutId = setTimeout(() => {
                if (!hasStarted) {
                    console.log('Timeout reached without server starting');

                    if (checkInterval) clearInterval(checkInterval);

                    // Kill any running llama processes before rejecting
                    this.killExistingProcesses().then(() => {
                        let errorOutput = 'No output captured';

                        // Try to get any available logs for error information
                        try {
                            if (fs.existsSync(this.logFilePath)) {
                                errorOutput = fs.readFileSync(this.logFilePath, 'utf8');
                            }
                        } catch (e) {
                            console.log('Error reading log file for error output:', e);
                        }

                        // Delete script file on error
                        try {
                            fs.unlinkSync(tempScriptPath);
                        } catch (e) {
                            console.log('Error deleting script file:', e);
                        }

                        reject({
                            message: 'Timeout: Server did not start within specified time',
                            output: errorOutput
                        });
                    });
                }
            }, timeoutMs);
        });
    }

    private executeCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log('Executing command:', command);
            exec(command, (error, stdout, stderr) => {
                if (error && !error.message.includes('not found')) {
                    console.log('Command error:', error);
                    reject(error);
                    return;
                }
                resolve(stdout || stderr);
            });
        });
    }
}
