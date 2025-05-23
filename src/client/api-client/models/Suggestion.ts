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
 * @interface Suggestion
 */
export interface Suggestion {
    /**
     * 
     * @type {string}
     * @memberof Suggestion
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Suggestion
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Suggestion
     */
    type: string;
}

/**
 * Check if a given object implements the Suggestion interface.
 */
export function instanceOfSuggestion(value: object): value is Suggestion {
    if (!('id' in value) || value['id'] === undefined) return false;
    if (!('name' in value) || value['name'] === undefined) return false;
    if (!('type' in value) || value['type'] === undefined) return false;
    return true;
}

export function SuggestionFromJSON(json: any): Suggestion {
    return SuggestionFromJSONTyped(json, false);
}

export function SuggestionFromJSONTyped(json: any, ignoreDiscriminator: boolean): Suggestion {
    if (json == null) {
        return json;
    }
    return {
        
        'id': json['id'],
        'name': json['name'],
        'type': json['type'],
    };
}

export function SuggestionToJSON(json: any): Suggestion {
    return SuggestionToJSONTyped(json, false);
}

export function SuggestionToJSONTyped(value?: Suggestion | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'id': value['id'],
        'name': value['name'],
        'type': value['type'],
    };
}

