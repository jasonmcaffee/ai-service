import { Injectable } from '@nestjs/common';
import { ModelsRepository } from '../repositories/models.repository';
import { CreateModel, HFModel, Model, ModelType, UpdateModel } from '../models/api/conversationApiModels';
import * as hub from "@huggingface/hub";
import config from '../config/config';
import { ModelEntry } from '@huggingface/hub';
// from huggingface_hub import HfApi



@Injectable()
export class ModelsService {
    constructor(private readonly modelsRepository: ModelsRepository) {}

    async searchModelsOnHuggingFace(query: string) : Promise<HFModel[]>{
        const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=50`;
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

    async downloadModelFromHuggingFace(id: string){

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
