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
  Conversation,
  CreateConversation,
  CreateMessage,
  Message,
} from '../models/index';
import {
    ConversationFromJSON,
    ConversationToJSON,
    CreateConversationFromJSON,
    CreateConversationToJSON,
    CreateMessageFromJSON,
    CreateMessageToJSON,
    MessageFromJSON,
    MessageToJSON,
} from '../models/index';

export interface AddMessageRequest {
    conversationId: string;
    createMessage: CreateMessage;
}

export interface CreateConversationRequest {
    createConversation: CreateConversation;
}

export interface DeleteConversationRequest {
    conversationId: string;
}

export interface GetConversationRequest {
    conversationId: string;
}

export interface NameConversationRequest {
    conversationId: string;
}

export interface UpdateConversationRequest {
    conversationId: string;
    conversation: Conversation;
}

/**
 * 
 */
export class ConversationApi extends runtime.BaseAPI {

    /**
     * Add a message to a conversation
     */
    async addMessageRaw(requestParameters: AddMessageRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Message>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling addMessage().'
            );
        }

        if (requestParameters['createMessage'] == null) {
            throw new runtime.RequiredError(
                'createMessage',
                'Required parameter "createMessage" was null or undefined when calling addMessage().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/conversations/{conversationId}/messages/message`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: CreateMessageToJSON(requestParameters['createMessage']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => MessageFromJSON(jsonValue));
    }

    /**
     * Add a message to a conversation
     */
    async addMessage(conversationId: string, createMessage: CreateMessage, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Message> {
        const response = await this.addMessageRaw({ conversationId: conversationId, createMessage: createMessage }, initOverrides);
        return await response.value();
    }

    /**
     * Create a new conversation
     */
    async createConversationRaw(requestParameters: CreateConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Conversation>> {
        if (requestParameters['createConversation'] == null) {
            throw new runtime.RequiredError(
                'createConversation',
                'Required parameter "createConversation" was null or undefined when calling createConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/conversations/conversation`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: CreateConversationToJSON(requestParameters['createConversation']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => ConversationFromJSON(jsonValue));
    }

    /**
     * Create a new conversation
     */
    async createConversation(createConversation: CreateConversation, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Conversation> {
        const response = await this.createConversationRaw({ createConversation: createConversation }, initOverrides);
        return await response.value();
    }

    /**
     * Delete a conversation
     */
    async deleteConversationRaw(requestParameters: DeleteConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling deleteConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/conversations/conversation/{conversationId}`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deleteConversationRaw({ conversationId: conversationId }, initOverrides);
    }

    /**
     * Get conversation by ID
     */
    async getConversationRaw(requestParameters: GetConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Conversation>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling getConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/conversations/conversation/{conversationId}`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => ConversationFromJSON(jsonValue));
    }

    /**
     * Get conversation by ID
     */
    async getConversation(conversationId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Conversation> {
        const response = await this.getConversationRaw({ conversationId: conversationId }, initOverrides);
        return await response.value();
    }

    /**
     * get all conversations for a member
     */
    async getConversationsForMemberRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<Conversation>>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/conversations/conversations/member`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(ConversationFromJSON));
    }

    /**
     * get all conversations for a member
     */
    async getConversationsForMember(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<Conversation>> {
        const response = await this.getConversationsForMemberRaw(initOverrides);
        return await response.value();
    }

    /**
     * Have ai name the conversation
     */
    async nameConversationRaw(requestParameters: NameConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Conversation>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling nameConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/conversations/conversation-name/{conversationId}/nameConversation`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => ConversationFromJSON(jsonValue));
    }

    /**
     * Have ai name the conversation
     */
    async nameConversation(conversationId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Conversation> {
        const response = await this.nameConversationRaw({ conversationId: conversationId }, initOverrides);
        return await response.value();
    }

    /**
     * Update an existing conversation
     */
    async updateConversationRaw(requestParameters: UpdateConversationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling updateConversation().'
            );
        }

        if (requestParameters['conversation'] == null) {
            throw new runtime.RequiredError(
                'conversation',
                'Required parameter "conversation" was null or undefined when calling updateConversation().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/conversations/conversation/{conversationId}`.replace(`{${"conversationId"}}`, encodeURIComponent(String(requestParameters['conversationId']))),
            method: 'PUT',
            headers: headerParameters,
            query: queryParameters,
            body: ConversationToJSON(requestParameters['conversation']),
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Update an existing conversation
     */
    async updateConversation(conversationId: string, conversation: Conversation, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.updateConversationRaw({ conversationId: conversationId, conversation: conversation }, initOverrides);
    }

}
