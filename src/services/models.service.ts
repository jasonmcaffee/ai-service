import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelsRepository } from '../repositories/models.repository';
import { CreateModel, HFModel, LlmFile, Model, ModelType, UpdateModel } from '../models/api/conversationApiModels';
import config from '../config/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsNoPromise from 'fs';
import DownloadSSESubject from '../models/DownloadSSESubject';

@Injectable()
export class ModelsService {
    // Store active downloads with AbortControllers and SSE subjects
    private activeDownloads: Record<string, {
        abortController: AbortController,
        fileName: string,
        downloadSSE?: DownloadSSESubject
    }> = {};

    constructor(private readonly modelsRepository: ModelsRepository) {}

    async searchModelsOnHuggingFace(query: string) : Promise<HFModel[]>{
        const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=50&full=true`;
        const headers: HeadersInit =  { 'Authorization': `Bearer ${config.getHuggingFaceAccessToken()}` };

        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data as HFModel[];
        } catch (error) {
            throw new Error(`Failed to search for hf models: ${(error as Error).message}`);
        }
    }

    createDownloadStreamForFile(memberId: string, modelId: string, filename: string): DownloadSSESubject {
        const downloadKey = `${memberId}-${modelId}-${filename}`;
        const downloadSSE = new DownloadSSESubject();

        // If there's already an active download for this file, return its SSE
        if (this.activeDownloads[downloadKey] && this.activeDownloads[downloadKey].downloadSSE) {
            return this.activeDownloads[downloadKey].downloadSSE;
        }

        // Create a new download entry or update the existing one
        if (!this.activeDownloads[downloadKey]) {
            const abortController = new AbortController();
            this.activeDownloads[downloadKey] = {
                abortController,
                fileName: filename,
                downloadSSE
            };
        } else {
            this.activeDownloads[downloadKey].downloadSSE = downloadSSE;
        }

        return downloadSSE;
    }

    /**
     * Reads all .gguf files from the configured LLM models folder
     * @returns An array of LlmFile objects
     */
    async getLlmModelsFolderGgufFiles(): Promise<LlmFile[]> {
        const modelsFolder = config.getLlmModelsFolder();
        const files: LlmFile[] = [];

        try {
            await fs.access(modelsFolder);
            // Read all files in the directory
            const allFiles = await fs.readdir(modelsFolder);
            // Filter for .gguf files
            const ggufFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.gguf');
            // Create LlmFile objects for each .gguf file
            for (const file of ggufFiles) {
                const filePath = path.join(modelsFolder, file);
                const stats = await fs.stat(filePath);
                // Convert file size from bytes to GB (1 GB = 1024^3 bytes)
                const fileSizeGB = stats.size / Math.pow(1024, 3);
                const createdDate = stats.birthtime.toISOString();
                files.push( {fileName: file, fileSizeGB, createdDate, filePath});
            }
            return files;
        } catch (error) {
            console.error(`Error reading GGUF files: ${error}`);
            return files;
        }
    }

    async deleteLlmFile(fileName: string): Promise<void> {
        // Validate that the filename has .gguf extension
        if (!fileName.toLowerCase().endsWith('.gguf')) {
            throw new Error(`'${fileName}' is not a valid GGUF file`);
        }
        const modelsFolder = config.getLlmModelsFolder();
        const filePath = path.join(modelsFolder, fileName);
        try {
            try {
                await fs.access(filePath);
            } catch (error) {
                throw new NotFoundException(`GGUF file '${fileName}' not found`);
            }
            // Verify it's actually a file and not a directory
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) {
                throw new NotFoundException(`'${fileName}' is not a file`);
            }
            await fs.unlink(filePath);
        } catch (error) {
            // Re-throw NotFoundException instances
            if (error instanceof NotFoundException) {
                throw error;
            }
            console.error(`Error deleting GGUF file '${fileName}': ${error}`);
            throw new Error(`Failed to delete GGUF file '${fileName}': ${error.message}`);
        }
    }

    async downloadFileFromHuggingFaceModelStreamDownloadProgress(memberId: string, modelId: string, filename: string, downloadSSE: DownloadSSESubject): Promise<void> {
        const url = `https://huggingface.co/${modelId}/resolve/main/${filename}`;
        const headers: HeadersInit = { 'Authorization': `Bearer ${config.getHuggingFaceAccessToken()}` };
        console.log(`Downloading from: ${url}`);
        const modelIdWithoutSlash = modelId.replaceAll('/', '-');
        const combinedFileName = `${modelIdWithoutSlash}-${filename}`;
        // Get or create download SSE subject
        const downloadKey = `${memberId}-${modelId}-${filename}`;
        const abortController = this.activeDownloads[downloadKey].abortController;

        const outputPath = path.join(config.getLlmModelsFolder(), combinedFileName);

        try {
            const response = await fetch(url, { headers, signal: abortController.signal });

            if (!response.ok) {
                const error = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                downloadSSE.sendError(error);
                throw error;
            }

            // Get the total size of the file
            const contentLength = Number(response.headers.get('content-length') || '0');

            if (!contentLength) {
                console.warn(`Warning: No content-length header received for ${filename}`);
            }

            // Create write stream to avoid keeping everything in memory
            const fileStream = fsNoPromise.createWriteStream(outputPath);

            // Read the response as a stream
            const reader = response?.body?.getReader();
            if (!reader) {
                const error = new Error('no reader on response body');
                downloadSSE.sendError(error);
                throw error;
            }

            let receivedBytes = 0;
            let lastProgressUpdate = Date.now();
            let startTime = Date.now();
            let lastReceivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // Write chunk directly to file
                await new Promise<void>((resolve, reject) => {
                    fileStream.write(Buffer.from(value), (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                receivedBytes += value.length;

                // Send progress updates every 1 second
                const now = Date.now();
                if (now - lastProgressUpdate > 1000) {
                    const elapsedSeconds = (now - startTime) / 1000;
                    const bytesPerSecond = receivedBytes / elapsedSeconds;
                    const downloadSpeed = bytesPerSecond / (1024 * 1024); // Convert to MBps

                    // Calculate bytes received since last update for current speed
                    const bytesInInterval = receivedBytes - lastReceivedBytes;
                    const intervalSeconds = (now - lastProgressUpdate) / 1000;
                    const currentSpeed = intervalSeconds > 0 ? bytesInInterval / intervalSeconds / (1024 * 1024) : 0;

                    // Calculate estimated time remaining
                    const remainingBytes = contentLength - receivedBytes;
                    const estimatedSecondsRemaining = currentSpeed > 0 ? remainingBytes / (currentSpeed * 1024 * 1024) : 0;

                    const percentComplete = contentLength ?
                        Math.round((receivedBytes / contentLength) * 100) : 0;

                    // Send progress update via SSE
                    downloadSSE.sendProgress({
                        fileName: combinedFileName,
                        modelId: modelId,
                        percentComplete,
                        downloadSpeed: parseFloat(currentSpeed.toFixed(2)),
                        estimatedSecondsRemaining: Math.round(estimatedSecondsRemaining)
                    });

                    console.log(`Download progress for ${filename}: ${percentComplete}% complete, ${currentSpeed.toFixed(2)} MBps`);
                    lastProgressUpdate = now;
                    lastReceivedBytes = receivedBytes;
                }
            }

            // Close the file stream properly
            await new Promise<void>((resolve, reject) => {
                fileStream.end((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log(`File saved to: ${outputPath}`);

            // Validate file size if content length was provided
            if (contentLength > 0) {
                const stats = await fs.stat(outputPath);
                if (stats.size !== contentLength) {
                    const error = new Error(`Downloaded file size (${stats.size} bytes) does not match expected size (${contentLength} bytes)`);
                    downloadSSE.sendError(error);
                    throw error;
                }
            }

            // Send final 100% complete update
            downloadSSE.sendProgress({
                fileName: combinedFileName,
                modelId: modelId,
                percentComplete: 100,
                downloadSpeed: 0,
                estimatedSecondsRemaining: 0
            });

            // Mark download as complete
            downloadSSE.sendComplete();

            // Remove from active downloads
            delete this.activeDownloads[downloadKey];
        } catch (error) {
            // Remove from active downloads
            delete this.activeDownloads[downloadKey];

            // Try to clean up partial file
            try {
                await fs.unlink(outputPath);
            } catch (cleanupError) {
                console.warn(`Failed to clean up partial download at ${outputPath}:`, cleanupError);
            }

            // Check if this was an abort error
            if ((error as Error).name === 'AbortError') {
                console.log(`Download of ${filename} was canceled`);
                return;
            }

            downloadSSE.sendError(error);

            console.error(`Error downloading ${filename}:`, error);
            throw error;
        }
    }

    async stopDownloadingHuggingFaceModelFile(memberId: string, modelId: string, fileName: string): Promise<boolean> {
        const downloadKey = `${memberId}-${modelId}-${fileName}`;
        if (this.activeDownloads[downloadKey]) {
            // Abort the download
            this.activeDownloads[downloadKey].abortController.abort();

            // Send complete signal if SSE exists
            if (this.activeDownloads[downloadKey].downloadSSE) {
                this.activeDownloads[downloadKey].downloadSSE.sendCompleteOnNextTick();
            }

            delete this.activeDownloads[downloadKey];
            return true;
        }
        return false;
    }

    async getModelTypes(): Promise<ModelType[]> {
        return this.modelsRepository.getModelTypes();
    }

    async getModelById(memberId: string, modelId: string): Promise<Model> {
        await this.ensureMemberOwnsModel(memberId, modelId);
        const model = await this.modelsRepository.getModelById(modelId);
        if(model === undefined){
            throw new Error(`Model id ${modelId} not found`);
        }
        return model;
    }

    async getModelByIdOrGetDefault(memberId: string, modelId?: string): Promise<Model> {
        if(modelId !== undefined){
            return this.getModelById(memberId, modelId);
        }
        const defaultModel = await this.modelsRepository.getDefaultModelForMember(memberId);
        if(defaultModel === undefined){
            throw new Error('Default model not found for member');
        }
        return defaultModel;
    }

    async getAllModelsForMember(memberId: string): Promise<Model[]> {
        return this.modelsRepository.getAllModelsForMember(memberId);
    }

    async createModel(memberId: string, model: CreateModel): Promise<Model> {
        return this.modelsRepository.createModel(model, memberId);
    }

    async updateModel(memberId: string, modelId: string, model: UpdateModel): Promise<Model> {
        await this.ensureMemberOwnsModel(memberId, modelId);
        return this.modelsRepository.updateModel(modelId, model);
    }

    async deleteModel(memberId: string, modelId: string): Promise<void> {
        await this.ensureMemberOwnsModel(memberId, modelId);
        await this.modelsRepository.deleteModel(modelId, memberId);
    }

    async ensureMemberOwnsModel(memberId: string, modelId: string): Promise<void> {
        await this.modelsRepository.ensureMemberOwnsModel(memberId, modelId);
    }
}
