/* tslint:disable */
/* eslint-disable */
/**
 * AI API
 * API to manage to interact with AI
 *
 * The version of the OpenAPI document: 1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import * as runtime from '../runtime';
import type {
  CreateModel,
  HFModel,
  LlmFile,
  Model,
  ModelType,
  UpdateModel,
} from '../models/index';
import {
    CreateModelFromJSON,
    CreateModelToJSON,
    HFModelFromJSON,
    HFModelToJSON,
    LlmFileFromJSON,
    LlmFileToJSON,
    ModelFromJSON,
    ModelToJSON,
    ModelTypeFromJSON,
    ModelTypeToJSON,
    UpdateModelFromJSON,
    UpdateModelToJSON,
} from '../models/index';

export interface CreateModelRequest {
    createModel: CreateModel;
}

export interface DeleteGgufFileRequest {
    fileName: string;
}

export interface DeleteModelRequest {
    modelId: string;
}

export interface DownloadFileWithProgressUpdatesRequest {
    modelId: string;
    filename: string;
}

export interface GetModelByIdRequest {
    modelId: string;
}

export interface SearchModelsOnHuggingFaceRequest {
    query: string;
}

export interface StopDownloadingHuggingFaceModelFileRequest {
    modelId: string;
    filename: string;
}

export interface UpdateModelRequest {
    modelId: string;
    updateModel: UpdateModel;
}

/**
 * 
 */
export class ModelsApi extends runtime.BaseAPI {

    /**
     * Create a new model
     */
    async createModelRaw(requestParameters: CreateModelRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Model>> {
        if (requestParameters['createModel'] == null) {
            throw new runtime.RequiredError(
                'createModel',
                'Required parameter "createModel" was null or undefined when calling createModel().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/models`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: CreateModelToJSON(requestParameters['createModel']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => ModelFromJSON(jsonValue));
    }

    /**
     * Create a new model
     */
    async createModel(createModel: CreateModel, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Model> {
        const response = await this.createModelRaw({ createModel: createModel }, initOverrides);
        return await response.value();
    }

    /**
     * Delete a GGUF file by filename
     */
    async deleteGgufFileRaw(requestParameters: DeleteGgufFileRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['fileName'] == null) {
            throw new runtime.RequiredError(
                'fileName',
                'Required parameter "fileName" was null or undefined when calling deleteGgufFile().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/gguf-files/{fileName}`.replace(`{${"fileName"}}`, encodeURIComponent(String(requestParameters['fileName']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Delete a GGUF file by filename
     */
    async deleteGgufFile(fileName: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deleteGgufFileRaw({ fileName: fileName }, initOverrides);
    }

    /**
     * Delete a model
     */
    async deleteModelRaw(requestParameters: DeleteModelRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['modelId'] == null) {
            throw new runtime.RequiredError(
                'modelId',
                'Required parameter "modelId" was null or undefined when calling deleteModel().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/{modelId}`.replace(`{${"modelId"}}`, encodeURIComponent(String(requestParameters['modelId']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Delete a model
     */
    async deleteModel(modelId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deleteModelRaw({ modelId: modelId }, initOverrides);
    }

    /**
     * Download a file from a HuggingFace model with progress updates via SSE
     */
    async downloadFileWithProgressUpdatesRaw(requestParameters: DownloadFileWithProgressUpdatesRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['modelId'] == null) {
            throw new runtime.RequiredError(
                'modelId',
                'Required parameter "modelId" was null or undefined when calling downloadFileWithProgressUpdates().'
            );
        }

        if (requestParameters['filename'] == null) {
            throw new runtime.RequiredError(
                'filename',
                'Required parameter "filename" was null or undefined when calling downloadFileWithProgressUpdates().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/downloadFileWithProgressUpdates/{modelId}/{filename}`.replace(`{${"modelId"}}`, encodeURIComponent(String(requestParameters['modelId']))).replace(`{${"filename"}}`, encodeURIComponent(String(requestParameters['filename']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Download a file from a HuggingFace model with progress updates via SSE
     */
    async downloadFileWithProgressUpdates(modelId: string, filename: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.downloadFileWithProgressUpdatesRaw({ modelId: modelId, filename: filename }, initOverrides);
    }

    /**
     * Get all models for the authenticated member
     */
    async getAllModelsForMemberRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<Model>>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(ModelFromJSON));
    }

    /**
     * Get all models for the authenticated member
     */
    async getAllModelsForMember(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<Model>> {
        const response = await this.getAllModelsForMemberRaw(initOverrides);
        return await response.value();
    }

    /**
     * Get all GGUF files from models folder
     */
    async getGgufFilesRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<LlmFile>>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/gguf-files`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(LlmFileFromJSON));
    }

    /**
     * Get all GGUF files from models folder
     */
    async getGgufFiles(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<LlmFile>> {
        const response = await this.getGgufFilesRaw(initOverrides);
        return await response.value();
    }

    /**
     * Get model by ID
     */
    async getModelByIdRaw(requestParameters: GetModelByIdRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Model>> {
        if (requestParameters['modelId'] == null) {
            throw new runtime.RequiredError(
                'modelId',
                'Required parameter "modelId" was null or undefined when calling getModelById().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/{modelId}`.replace(`{${"modelId"}}`, encodeURIComponent(String(requestParameters['modelId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => ModelFromJSON(jsonValue));
    }

    /**
     * Get model by ID
     */
    async getModelById(modelId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Model> {
        const response = await this.getModelByIdRaw({ modelId: modelId }, initOverrides);
        return await response.value();
    }

    /**
     * Get all model types
     */
    async getModelTypesRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<ModelType>>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/model-types`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(ModelTypeFromJSON));
    }

    /**
     * Get all model types
     */
    async getModelTypes(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<ModelType>> {
        const response = await this.getModelTypesRaw(initOverrides);
        return await response.value();
    }

    /**
     * Search for models on HuggingFace
     */
    async searchModelsOnHuggingFaceRaw(requestParameters: SearchModelsOnHuggingFaceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<HFModel>>> {
        if (requestParameters['query'] == null) {
            throw new runtime.RequiredError(
                'query',
                'Required parameter "query" was null or undefined when calling searchModelsOnHuggingFace().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['query'] != null) {
            queryParameters['query'] = requestParameters['query'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/huggingface/search`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(HFModelFromJSON));
    }

    /**
     * Search for models on HuggingFace
     */
    async searchModelsOnHuggingFace(query: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<HFModel>> {
        const response = await this.searchModelsOnHuggingFaceRaw({ query: query }, initOverrides);
        return await response.value();
    }

    /**
     * Stop downloading a file from HuggingFace model
     */
    async stopDownloadingHuggingFaceModelFileRaw(requestParameters: StopDownloadingHuggingFaceModelFileRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['modelId'] == null) {
            throw new runtime.RequiredError(
                'modelId',
                'Required parameter "modelId" was null or undefined when calling stopDownloadingHuggingFaceModelFile().'
            );
        }

        if (requestParameters['filename'] == null) {
            throw new runtime.RequiredError(
                'filename',
                'Required parameter "filename" was null or undefined when calling stopDownloadingHuggingFaceModelFile().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/models/stopDownloadingHuggingFaceModelFile/{modelId}/{filename}`.replace(`{${"modelId"}}`, encodeURIComponent(String(requestParameters['modelId']))).replace(`{${"filename"}}`, encodeURIComponent(String(requestParameters['filename']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Stop downloading a file from HuggingFace model
     */
    async stopDownloadingHuggingFaceModelFile(modelId: string, filename: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.stopDownloadingHuggingFaceModelFileRaw({ modelId: modelId, filename: filename }, initOverrides);
    }

    /**
     * Update an existing model
     */
    async updateModelRaw(requestParameters: UpdateModelRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Model>> {
        if (requestParameters['modelId'] == null) {
            throw new runtime.RequiredError(
                'modelId',
                'Required parameter "modelId" was null or undefined when calling updateModel().'
            );
        }

        if (requestParameters['updateModel'] == null) {
            throw new runtime.RequiredError(
                'updateModel',
                'Required parameter "updateModel" was null or undefined when calling updateModel().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/models/{modelId}`.replace(`{${"modelId"}}`, encodeURIComponent(String(requestParameters['modelId']))),
            method: 'PUT',
            headers: headerParameters,
            query: queryParameters,
            body: UpdateModelToJSON(requestParameters['updateModel']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => ModelFromJSON(jsonValue));
    }

    /**
     * Update an existing model
     */
    async updateModel(modelId: string, updateModel: UpdateModel, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Model> {
        const response = await this.updateModelRaw({ modelId: modelId, updateModel: updateModel }, initOverrides);
        return await response.value();
    }

}
