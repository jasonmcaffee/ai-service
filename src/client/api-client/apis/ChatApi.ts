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

export interface StreamInferenceRequest {
    prompt: string;
    conversationId: string;
}

/**
 * 
 */
export class ChatApi extends runtime.BaseAPI {

    /**
     * Stream a message based on a prompt
     */
    async streamInferenceRaw(requestParameters: StreamInferenceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<string>> {
        if (requestParameters['prompt'] == null) {
            throw new runtime.RequiredError(
                'prompt',
                'Required parameter "prompt" was null or undefined when calling streamInference().'
            );
        }

        if (requestParameters['conversationId'] == null) {
            throw new runtime.RequiredError(
                'conversationId',
                'Required parameter "conversationId" was null or undefined when calling streamInference().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['prompt'] != null) {
            queryParameters['prompt'] = requestParameters['prompt'];
        }

        if (requestParameters['conversationId'] != null) {
            queryParameters['conversationId'] = requestParameters['conversationId'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/chat/streamInference`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<string>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Stream a message based on a prompt
     */
    async streamInference(prompt: string, conversationId: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<string> {
        const response = await this.streamInferenceRaw({ prompt: prompt, conversationId: conversationId }, initOverrides);
        return await response.value();
    }

}
