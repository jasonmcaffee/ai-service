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
import type { Datasource } from './Datasource';
import {
    DatasourceFromJSON,
    DatasourceFromJSONTyped,
    DatasourceToJSON,
    DatasourceToJSONTyped,
} from './Datasource';
import type { Message } from './Message';
import {
    MessageFromJSON,
    MessageFromJSONTyped,
    MessageToJSON,
    MessageToJSONTyped,
} from './Message';

/**
 * 
 * @export
 * @interface Conversation
 */
export interface Conversation {
    /**
     * 
     * @type {string}
     * @memberof Conversation
     */
    conversationId: string;
    /**
     * 
     * @type {string}
     * @memberof Conversation
     */
    conversationName: string;
    /**
     * 
     * @type {string}
     * @memberof Conversation
     */
    createdDate: string;
    /**
     * 
     * @type {Array<Message>}
     * @memberof Conversation
     */
    messages: Array<Message> | null;
    /**
     * 
     * @type {Array<Datasource>}
     * @memberof Conversation
     */
    datasources: Array<Datasource> | null;
}

/**
 * Check if a given object implements the Conversation interface.
 */
export function instanceOfConversation(value: object): value is Conversation {
    if (!('conversationId' in value) || value['conversationId'] === undefined) return false;
    if (!('conversationName' in value) || value['conversationName'] === undefined) return false;
    if (!('createdDate' in value) || value['createdDate'] === undefined) return false;
    if (!('messages' in value) || value['messages'] === undefined) return false;
    if (!('datasources' in value) || value['datasources'] === undefined) return false;
    return true;
}

export function ConversationFromJSON(json: any): Conversation {
    return ConversationFromJSONTyped(json, false);
}

export function ConversationFromJSONTyped(json: any, ignoreDiscriminator: boolean): Conversation {
    if (json == null) {
        return json;
    }
    return {
        
        'conversationId': json['conversationId'],
        'conversationName': json['conversationName'],
        'createdDate': json['createdDate'],
        'messages': (json['messages'] == null ? null : (json['messages'] as Array<any>).map(MessageFromJSON)),
        'datasources': (json['datasources'] == null ? null : (json['datasources'] as Array<any>).map(DatasourceFromJSON)),
    };
}

export function ConversationToJSON(json: any): Conversation {
    return ConversationToJSONTyped(json, false);
}

export function ConversationToJSONTyped(value?: Conversation | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'conversationId': value['conversationId'],
        'conversationName': value['conversationName'],
        'createdDate': value['createdDate'],
        'messages': (value['messages'] == null ? null : (value['messages'] as Array<any>).map(MessageToJSON)),
        'datasources': (value['datasources'] == null ? null : (value['datasources'] as Array<any>).map(DatasourceToJSON)),
    };
}

