import { Injectable } from '@nestjs/common';
import { ModelsRepository } from '../repositories/models.repository';
import {CreateModel, Model, ModelType, UpdateModel} from '../models/api/conversationApiModels';

@Injectable()
export class ModelsService {
    constructor(private readonly modelsRepository: ModelsRepository) {}

    async getModelTypes(): Promise<ModelType[]> {
        return this.modelsRepository.getModelTypes();
    }

    async getModelById(memberId: string, modelId: number): Promise<Model | undefined> {
        await this.ensureMemberOwnsModel(memberId, modelId);
        return this.modelsRepository.getModelById(modelId);
    }

    async getAllModelsForMember(memberId: string): Promise<Model[]> {
        return this.modelsRepository.getAllModelsForMember(memberId);
    }

    async createModel(memberId: string, model: CreateModel): Promise<Model> {
        return this.modelsRepository.createModel(model, memberId);
    }

    async updateModel(memberId: string, modelId: number, model: UpdateModel): Promise<Model> {
        await this.ensureMemberOwnsModel(memberId, modelId);
        return this.modelsRepository.updateModel(modelId, model);
    }

    async deleteModel(memberId: string, modelId: number): Promise<void> {
        await this.ensureMemberOwnsModel(memberId, modelId);
        await this.modelsRepository.deleteModel(modelId, memberId);
    }

    async ensureMemberOwnsModel(memberId: string, modelId: number): Promise<void> {
        await this.modelsRepository.ensureMemberOwnsModel(memberId, modelId);
    }
}
