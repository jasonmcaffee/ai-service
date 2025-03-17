import { Injectable } from '@nestjs/common';
import { ModelsRepository } from '../repositories/models.repository';
import { CreateModel, HFModel, Model, ModelType, UpdateModel } from '../models/api/conversationApiModels';
import config from '../config/config';
import * as path from 'path';
import * as fs from 'fs/promises';
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

    // async downloadFileFromHuggingFaceModel(memberId: string, modelId: string, filename: string){
    //     const url = `https://huggingface.co/${modelId}/resolve/main/${filename}`;
    //     const headers: HeadersInit =  { 'Authorization': `Bearer ${config.getHuggingFaceAccessToken()}` };
    //     console.log(`Downloading from: ${url}`);
    //
    //     // Create an AbortController for this download
    //     const abortController = new AbortController();
    //     const downloadKey = `${memberId}-${filename}`;
    //     this.activeDownloads[downloadKey] = { abortController, fileName: filename };
    //
    //     try {
    //         const response = await fetch(url, {
    //             headers,
    //             signal: abortController.signal
    //         });
    //
    //         if (!response.ok) {
    //             throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    //         }
    //
    //         // Get the total size of the file
    //         const contentLength = Number(response.headers.get('content-length'));
    //
    //         // Read the response as a stream
    //         const reader = response?.body?.getReader();
    //         if(!reader){ throw new Error('no reader on response body'); }
    //         const chunks: Uint8Array[] = [];
    //         let receivedBytes = 0;
    //         let lastProgressUpdate = Date.now();
    //         while (true) {
    //             const { done, value } = await reader.read();
    //
    //             if (done) {
    //                 break;
    //             }
    //
    //             chunks.push(value);
    //             receivedBytes += value.length;
    //
    //             // Log progress every 5 seconds
    //             const now = Date.now();
    //             if (now - lastProgressUpdate > 1000) {
    //                 const percentComplete = contentLength ?
    //                   Math.round((receivedBytes / contentLength) * 100) :
    //                   'unknown';
    //                 console.log(`Download progress for ${filename}: ${percentComplete}% complete`);
    //                 lastProgressUpdate = now;
    //             }
    //         }
    //
    //         // Concatenate all chunks into a single Buffer
    //         const concatenated = new Uint8Array(receivedBytes);
    //         let position = 0;
    //         for (const chunk of chunks) {
    //             concatenated.set(chunk, position);
    //             position += chunk.length;
    //         }
    //
    //         const buffer = Buffer.from(concatenated);
    //         const outputPath = path.join(config.getLlmModelsFolder(), filename);
    //         await fs.writeFile(outputPath, buffer);
    //         console.log(`File saved to: ${outputPath}`);
    //
    //         // Remove from active downloads
    //         delete this.activeDownloads[downloadKey];
    //     } catch (error) {
    //         // Remove from active downloads
    //         delete this.activeDownloads[downloadKey];
    //
    //         // Check if this was an abort error
    //         if ((error as Error).name === 'AbortError') {
    //             console.log(`Download of ${filename} was canceled`);
    //             return;
    //         }
    //
    //         console.error(`Error downloading ${filename}:`, error);
    //         throw error;
    //     }
    // }

    createDownloadStreamForFile(memberId: string, modelId: string, filename: string): DownloadSSESubject {
        const downloadKey = `${memberId}-${filename}`;
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

    async downloadFileFromHuggingFaceModelStreamDownloadProgress(memberId: string, modelId: string, filename: string, downloadSSE: DownloadSSESubject): Promise<void> {
        const url = `https://huggingface.co/${modelId}/resolve/main/${filename}`;
        const headers: HeadersInit = { 'Authorization': `Bearer ${config.getHuggingFaceAccessToken()}` };
        console.log(`Downloading from: ${url}`);

        // Get or create download SSE subject
        const downloadKey = `${memberId}-${filename}`;
        const abortController = this.activeDownloads[downloadKey].abortController;

        try {
            const response = await fetch(url, {
                headers,
                signal: abortController.signal
            });

            if (!response.ok) {
                const error = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                downloadSSE.sendError(error);
                throw error;
            }

            // Get the total size of the file
            const contentLength = Number(response.headers.get('content-length'));

            // Read the response as a stream
            const reader = response?.body?.getReader();
            if (!reader) {
                const error = new Error('no reader on response body');
                downloadSSE.sendError(error);
                throw error;
            }

            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;
            let lastProgressUpdate = Date.now();
            let startTime = Date.now();
            let lastReceivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                chunks.push(value);
                receivedBytes += value.length;

                // Send progress updates every 5 seconds
                const now = Date.now();
                if (now - lastProgressUpdate > 5000) {
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
                        fileName: filename,
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

            // Concatenate all chunks into a single Buffer
            const concatenated = new Uint8Array(receivedBytes);
            let position = 0;
            for (const chunk of chunks) {
                concatenated.set(chunk, position);
                position += chunk.length;
            }

            const buffer = Buffer.from(concatenated);
            const outputPath = path.join(config.getLlmModelsFolder(), filename);
            await fs.writeFile(outputPath, buffer);
            console.log(`File saved to: ${outputPath}`);

            // Send final 100% complete update
            downloadSSE.sendProgress({
                fileName: filename,
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
            // Send error to client
            if (downloadSSE) {
                downloadSSE.sendError(error);
            }

            // Remove from active downloads
            delete this.activeDownloads[downloadKey];

            // Check if this was an abort error
            if ((error as Error).name === 'AbortError') {
                console.log(`Download of ${filename} was canceled`);
                return;
            }

            console.error(`Error downloading ${filename}:`, error);
            throw error;
        }
    }

    async stopDownloadingHuggingFaceModelFile(memberId: string, fileName: string): Promise<boolean> {
        const downloadKey = `${memberId}-${fileName}`;
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
