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
 * @interface UpdateModel
 */
export interface UpdateModel {
    /**
     * 
     * @type {string}
     * @memberof UpdateModel
     */
    displayName: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateModel
     */
    url: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateModel
     */
    apiKey: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateModel
     */
    modelName: string;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateModel
     */
    isDefault: boolean;
    /**
     * 
     * @type {number}
     * @memberof UpdateModel
     */
    modelTypeId: number;
    /**
     * 
     * @type {string}
     * @memberof UpdateModel
     */
    initialMessage: string;
}

/**
 * Check if a given object implements the UpdateModel interface.
 */
export function instanceOfUpdateModel(value: object): value is UpdateModel {
    if (!('displayName' in value) || value['displayName'] === undefined) return false;
    if (!('url' in value) || value['url'] === undefined) return false;
    if (!('apiKey' in value) || value['apiKey'] === undefined) return false;
    if (!('modelName' in value) || value['modelName'] === undefined) return false;
    if (!('isDefault' in value) || value['isDefault'] === undefined) return false;
    if (!('modelTypeId' in value) || value['modelTypeId'] === undefined) return false;
    if (!('initialMessage' in value) || value['initialMessage'] === undefined) return false;
    return true;
}

export function UpdateModelFromJSON(json: any): UpdateModel {
    return UpdateModelFromJSONTyped(json, false);
}

export function UpdateModelFromJSONTyped(json: any, ignoreDiscriminator: boolean): UpdateModel {
    if (json == null) {
        return json;
    }
    return {
        
        'displayName': json['displayName'],
        'url': json['url'],
        'apiKey': json['apiKey'],
        'modelName': json['modelName'],
        'isDefault': json['isDefault'],
        'modelTypeId': json['modelTypeId'],
        'initialMessage': json['initialMessage'],
    };
}

export function UpdateModelToJSON(json: any): UpdateModel {
    return UpdateModelToJSONTyped(json, false);
}

export function UpdateModelToJSONTyped(value?: UpdateModel | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'displayName': value['displayName'],
        'url': value['url'],
        'apiKey': value['apiKey'],
        'modelName': value['modelName'],
        'isDefault': value['isDefault'],
        'modelTypeId': value['modelTypeId'],
        'initialMessage': value['initialMessage'],
    };
}

