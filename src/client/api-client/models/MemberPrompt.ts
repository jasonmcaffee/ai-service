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
 * @interface MemberPrompt
 */
export interface MemberPrompt {
    /**
     * 
     * @type {string}
     * @memberof MemberPrompt
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MemberPrompt
     */
    promptName: string;
    /**
     * 
     * @type {string}
     * @memberof MemberPrompt
     */
    memberId: string;
    /**
     * 
     * @type {string}
     * @memberof MemberPrompt
     */
    promptText: string;
}

/**
 * Check if a given object implements the MemberPrompt interface.
 */
export function instanceOfMemberPrompt(value: object): value is MemberPrompt {
    if (!('id' in value) || value['id'] === undefined) return false;
    if (!('promptName' in value) || value['promptName'] === undefined) return false;
    if (!('memberId' in value) || value['memberId'] === undefined) return false;
    if (!('promptText' in value) || value['promptText'] === undefined) return false;
    return true;
}

export function MemberPromptFromJSON(json: any): MemberPrompt {
    return MemberPromptFromJSONTyped(json, false);
}

export function MemberPromptFromJSONTyped(json: any, ignoreDiscriminator: boolean): MemberPrompt {
    if (json == null) {
        return json;
    }
    return {
        
        'id': json['id'],
        'promptName': json['promptName'],
        'memberId': json['memberId'],
        'promptText': json['promptText'],
    };
}

export function MemberPromptToJSON(json: any): MemberPrompt {
    return MemberPromptToJSONTyped(json, false);
}

export function MemberPromptToJSONTyped(value?: MemberPrompt | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'id': value['id'],
        'promptName': value['promptName'],
        'memberId': value['memberId'],
        'promptText': value['promptText'],
    };
}

