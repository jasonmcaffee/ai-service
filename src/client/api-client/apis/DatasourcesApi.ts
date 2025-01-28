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
  CreateDatasource,
  CreateDocument,
  Datasource,
  Document,
} from '../models/index';
import {
    CreateDatasourceFromJSON,
    CreateDatasourceToJSON,
    CreateDocumentFromJSON,
    CreateDocumentToJSON,
    DatasourceFromJSON,
    DatasourceToJSON,
    DocumentFromJSON,
    DocumentToJSON,
} from '../models/index';

export interface CreateDatasourceRequest {
    createDatasource: CreateDatasource;
}

export interface CreateDocumentRequest {
    createDocument: CreateDocument;
}

export interface GetDatasourceByIdRequest {
    datasourceId: number;
}

export interface GetDatasourcesForConversationRequest {
    conversationId: string;
}

export interface GetDocumentByIdRequest {
    documentId: number;
}

export interface GetDocumentsForConversationRequest {
    conversationId: string;
}

export interface GetDocumentsForDatasourceRequest {
    datasourceId: number;
}

/**
 * 
 */
export class DatasourcesApi extends runtime.BaseAPI {

    /**
     * Create a new datasource
     */
    async createDatasourceRaw(requestParameters: CreateDatasourceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Datasource>> {
        if (requestParameters['createDatasource'] == null) {
            throw new runtime.RequiredError(
                'createDatasource',
                'Required parameter "createDatasource" was null or undefined when calling createDatasource().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/datasources`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: CreateDatasourceToJSON(requestParameters['createDatasource']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => DatasourceFromJSON(jsonValue));
    }

    /**
     * Create a new datasource
     */
    async createDatasource(createDatasource: CreateDatasource, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Datasource> {
        const response = await this.createDatasourceRaw({ createDatasource: createDatasource }, initOverrides);
        return await response.value();
    }

    /**
     * Create a new document
     */
    async createDocumentRaw(requestParameters: CreateDocumentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Document>> {
        if (requestParameters['createDocument'] == null) {
            throw new runtime.RequiredError(
                'createDocument',
                'Required parameter "createDocument" was null or undefined when calling createDocument().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/datasources/documents`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: CreateDocumentToJSON(requestParameters['createDocument']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => DocumentFromJSON(jsonValue));
    }

    /**
     * Create a new document
     */
    async createDocument(createDocument: CreateDocument, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Document> {
        const response = await this.createDocumentRaw({ createDocument: createDocument }, initOverrides);
        return await response.value();
    }

    /**
     * Get datasource by ID
     */
    async getDatasourceByIdRaw(requestParameters: GetDatasourceByIdRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Datasource>> {
        if (requestParameters['datasourceId'] == null) {
            throw new runtime.RequiredError(
                'datasourceId',
                'Required parameter "datasourceId" was null or undefined when calling getDatasourceById().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/datasources/{datasourceId}`.replace(`{${"datasourceId"}}`, encodeURIComponent(String(requestParameters['datasourceId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => DatasourceFromJSON(jsonValue));
    }

    /**
     * Get datasource by ID
     */
    async getDatasourceById(datasourceId: number, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Datasource> {
        const response = await this.getDatasourceByIdRaw({ datasourceId: datasourceId }, initOverrides);
        return await response.value();
    }

    /**
     * Get all datasources for a conversation
     */
    async getDatasourcesForConversationRaw(requestParameters: GetDatasourcesForConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<Datasource>>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling getDatasourcesForConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/datasources/conversation/{conversationId}`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(DatasourceFromJSON));
    }

    /**
     * Get all datasources for a conversation
     */
    async getDatasourcesForConversation(conversationId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<Datasource>> {
        const response = await this.getDatasourcesForConversationRaw({ conversationId: conversationId }, initOverrides);
        return await response.value();
    }

    /**
     * Get document by ID
     */
    async getDocumentByIdRaw(requestParameters: GetDocumentByIdRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Document>> {
        if (requestParameters['documentId'] == null) {
            throw new runtime.RequiredError(
                'documentId',
                'Required parameter "documentId" was null or undefined when calling getDocumentById().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/datasources/documents/{documentId}`.replace(`{${"documentId"}}`, encodeURIComponent(String(requestParameters['documentId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => DocumentFromJSON(jsonValue));
    }

    /**
     * Get document by ID
     */
    async getDocumentById(documentId: number, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Document> {
        const response = await this.getDocumentByIdRaw({ documentId: documentId }, initOverrides);
        return await response.value();
    }

    /**
     * Get all documents for a conversation
     */
    async getDocumentsForConversationRaw(requestParameters: GetDocumentsForConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<Document>>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling getDocumentsForConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/datasources/conversation/{conversationId}/documents`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(DocumentFromJSON));
    }

    /**
     * Get all documents for a conversation
     */
    async getDocumentsForConversation(conversationId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<Document>> {
        const response = await this.getDocumentsForConversationRaw({ conversationId: conversationId }, initOverrides);
        return await response.value();
    }

    /**
     * Get all documents for a datasource
     */
    async getDocumentsForDatasourceRaw(requestParameters: GetDocumentsForDatasourceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<Document>>> {
        if (requestParameters['datasourceId'] == null) {
            throw new runtime.RequiredError(
                'datasourceId',
                'Required parameter "datasourceId" was null or undefined when calling getDocumentsForDatasource().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/datasources/{datasourceId}/documents`.replace(`{${"datasourceId"}}`, encodeURIComponent(String(requestParameters['datasourceId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(DocumentFromJSON));
    }

    /**
     * Get all documents for a datasource
     */
    async getDocumentsForDatasource(datasourceId: number, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<Document>> {
        const response = await this.getDocumentsForDatasourceRaw({ datasourceId: datasourceId }, initOverrides);
        return await response.value();
    }

}
