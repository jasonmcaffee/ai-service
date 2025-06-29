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
import type { HFModelSibling } from './HFModelSibling';
import {
    HFModelSiblingFromJSON,
    HFModelSiblingFromJSONTyped,
    HFModelSiblingToJSON,
    HFModelSiblingToJSONTyped,
} from './HFModelSibling';

/**
 * 
 * @export
 * @interface HFModel
 */
export interface HFModel {
    /**
     * 
     * @type {string}
     * @memberof HFModel
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof HFModel
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof HFModel
     */
    modelId: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof HFModel
     */
    tags: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof HFModel
     */
    pipelineTag: string;
    /**
     * 
     * @type {string}
     * @memberof HFModel
     */
    libraryName: string;
    /**
     * 
     * @type {string}
     * @memberof HFModel
     */
    createdAt: string;
    /**
     * 
     * @type {number}
     * @memberof HFModel
     */
    downloads: number;
    /**
     * 
     * @type {number}
     * @memberof HFModel
     */
    likes: number;
    /**
     * 
     * @type {Array<HFModelSibling>}
     * @memberof HFModel
     */
    siblings: Array<HFModelSibling>;
}

/**
 * Check if a given object implements the HFModel interface.
 */
export function instanceOfHFModel(value: object): value is HFModel {
    if (!('id' in value) || value['id'] === undefined) return false;
    if (!('name' in value) || value['name'] === undefined) return false;
    if (!('modelId' in value) || value['modelId'] === undefined) return false;
    if (!('tags' in value) || value['tags'] === undefined) return false;
    if (!('pipelineTag' in value) || value['pipelineTag'] === undefined) return false;
    if (!('libraryName' in value) || value['libraryName'] === undefined) return false;
    if (!('createdAt' in value) || value['createdAt'] === undefined) return false;
    if (!('downloads' in value) || value['downloads'] === undefined) return false;
    if (!('likes' in value) || value['likes'] === undefined) return false;
    if (!('siblings' in value) || value['siblings'] === undefined) return false;
    return true;
}

export function HFModelFromJSON(json: any): HFModel {
    return HFModelFromJSONTyped(json, false);
}

export function HFModelFromJSONTyped(json: any, ignoreDiscriminator: boolean): HFModel {
    if (json == null) {
        return json;
    }
    return {
        
        'id': json['id'],
        'name': json['name'],
        'modelId': json['modelId'],
        'tags': json['tags'],
        'pipelineTag': json['pipeline_tag'],
        'libraryName': json['library_name'],
        'createdAt': json['createdAt'],
        'downloads': json['downloads'],
        'likes': json['likes'],
        'siblings': ((json['siblings'] as Array<any>).map(HFModelSiblingFromJSON)),
    };
}

export function HFModelToJSON(json: any): HFModel {
    return HFModelToJSONTyped(json, false);
}

export function HFModelToJSONTyped(value?: HFModel | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'id': value['id'],
        'name': value['name'],
        'modelId': value['modelId'],
        'tags': value['tags'],
        'pipeline_tag': value['pipelineTag'],
        'library_name': value['libraryName'],
        'createdAt': value['createdAt'],
        'downloads': value['downloads'],
        'likes': value['likes'],
        'siblings': ((value['siblings'] as Array<any>).map(HFModelSiblingToJSON)),
    };
}

