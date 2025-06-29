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
  BatchCreateUrlRequest,
  BatchCreateUrlResponse,
  CreateUrl,
  Url,
} from '../models/index';
import {
    BatchCreateUrlRequestFromJSON,
    BatchCreateUrlRequestToJSON,
    BatchCreateUrlResponseFromJSON,
    BatchCreateUrlResponseToJSON,
    CreateUrlFromJSON,
    CreateUrlToJSON,
    UrlFromJSON,
    UrlToJSON,
} from '../models/index';

export interface CreateShortUrlRequest {
    createUrl: CreateUrl;
}

export interface CreateShortUrlsRequest {
    batchCreateUrlRequest: BatchCreateUrlRequest;
}

export interface GetUrlInfoRequest {
    id: string;
}

export interface RedirectToOriginalUrlRequest {
    id: string;
}

/**
 * 
 */
export class URLShorteningApi extends runtime.BaseAPI {

    /**
     * Create a shortened URL
     */
    async createShortUrlRaw(requestParameters: CreateShortUrlRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Url>> {
        if (requestParameters['createUrl'] == null) {
            throw new runtime.RequiredError(
                'createUrl',
                'Required parameter "createUrl" was null or undefined when calling createShortUrl().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/proxy/urls`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: CreateUrlToJSON(requestParameters['createUrl']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => UrlFromJSON(jsonValue));
    }

    /**
     * Create a shortened URL
     */
    async createShortUrl(createUrl: CreateUrl, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Url> {
        const response = await this.createShortUrlRaw({ createUrl: createUrl }, initOverrides);
        return await response.value();
    }

    /**
     * Create multiple shortened URLs in a batch
     */
    async createShortUrlsRaw(requestParameters: CreateShortUrlsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<BatchCreateUrlResponse>> {
        if (requestParameters['batchCreateUrlRequest'] == null) {
            throw new runtime.RequiredError(
                'batchCreateUrlRequest',
                'Required parameter "batchCreateUrlRequest" was null or undefined when calling createShortUrls().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/proxy/urls/batch`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: BatchCreateUrlRequestToJSON(requestParameters['batchCreateUrlRequest']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => BatchCreateUrlResponseFromJSON(jsonValue));
    }

    /**
     * Create multiple shortened URLs in a batch
     */
    async createShortUrls(batchCreateUrlRequest: BatchCreateUrlRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<BatchCreateUrlResponse> {
        const response = await this.createShortUrlsRaw({ batchCreateUrlRequest: batchCreateUrlRequest }, initOverrides);
        return await response.value();
    }

    /**
     * Get URL information
     */
    async getUrlInfoRaw(requestParameters: GetUrlInfoRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Url>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling getUrlInfo().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/proxy/urls/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => UrlFromJSON(jsonValue));
    }

    /**
     * Get URL information
     */
    async getUrlInfo(id: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Url> {
        const response = await this.getUrlInfoRaw({ id: id }, initOverrides);
        return await response.value();
    }

    /**
     * Redirect to original URL
     */
    async redirectToOriginalUrlRaw(requestParameters: RedirectToOriginalUrlRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling redirectToOriginalUrl().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/proxy/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Redirect to original URL
     */
    async redirectToOriginalUrl(id: string, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.redirectToOriginalUrlRaw({ id: id }, initOverrides);
    }

}
