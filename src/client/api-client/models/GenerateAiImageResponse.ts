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

import { mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface GenerateAiImageResponse
 */
export interface GenerateAiImageResponse {
    /**
     * 
     * @type {string}
     * @memberof GenerateAiImageResponse
     */
    promptId: string;
}

/**
 * Check if a given object implements the GenerateAiImageResponse interface.
 */
export function instanceOfGenerateAiImageResponse(value: object): value is GenerateAiImageResponse {
    if (!('promptId' in value) || value['promptId'] === undefined) return false;
    return true;
}

export function GenerateAiImageResponseFromJSON(json: any): GenerateAiImageResponse {
    return GenerateAiImageResponseFromJSONTyped(json, false);
}

export function GenerateAiImageResponseFromJSONTyped(json: any, ignoreDiscriminator: boolean): GenerateAiImageResponse {
    if (json == null) {
        return json;
    }
    return {
        
        'promptId': json['promptId'],
    };
}

export function GenerateAiImageResponseToJSON(json: any): GenerateAiImageResponse {
    return GenerateAiImageResponseToJSONTyped(json, false);
}

export function GenerateAiImageResponseToJSONTyped(value?: GenerateAiImageResponse | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'promptId': value['promptId'],
    };
}

