import { Injectable } from '@nestjs/common';
import { ModelsRepository } from '../repositories/models.repository';
import { CreateModel, HFModel, Model, ModelType, UpdateModel } from '../models/api/conversationApiModels';
import config from '../config/config';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class ModelsService {
    // Store active downloads with AbortControllers
    private activeDownloads: Record<string, { abortController: AbortController, fileName: string }> = {};

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

    async downloadFileFromHuggingFaceModel(memberId: string, modelId: string, filename: string){
        const url = `https://huggingface.co/${modelId}/resolve/main/${filename}`;
        const headers: HeadersInit =  { 'Authorization': `Bearer ${config.getHuggingFaceAccessToken()}` };
        console.log(`Downloading from: ${url}`);

        // Create an AbortController for this download
        const abortController = new AbortController();
        const downloadKey = `${memberId}-${filename}`;
        this.activeDownloads[downloadKey] = { abortController, fileName: filename };

        try {
            const response = await fetch(url, {
                headers,
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            }

            // Get the total size of the file
            const contentLength = Number(response.headers.get('content-length'));

            // Read the response as a stream
            const reader = response?.body?.getReader();
            if(!reader){ throw new Error('no reader on response body'); }
            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;
            let lastProgressUpdate = Date.now();
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                chunks.push(value);
                receivedBytes += value.length;

                // Log progress every 5 seconds
                const now = Date.now();
                if (now - lastProgressUpdate > 1000) {
                    const percentComplete = contentLength ?
                      Math.round((receivedBytes / contentLength) * 100) :
                      'unknown';
                    console.log(`Download progress for ${filename}: ${percentComplete}% complete`);
                    lastProgressUpdate = now;
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

            // Remove from active downloads
            delete this.activeDownloads[downloadKey];
        } catch (error) {
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
            this.activeDownloads[downloadKey].abortController.abort();
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
