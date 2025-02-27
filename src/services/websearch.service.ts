import config from '../config/config';
import {Injectable} from "@nestjs/common";
import {
    GetPageContentsResponse,
    Model,
    SearchResult,
    SearchResultResponse,
} from '../models/api/conversationApiModels';
import {Browser, BrowserContext, Page} from 'playwright';
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
import { Observable, Subject, lastValueFrom } from 'rxjs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { markdownWebPagePrompt, markdownWithoutVowelsWebPagePrompt } from '../utils/prompts';
import { ModelsService } from './models.service';
import InferenceSSESubject from '../models/InferenceSSESubject';
import {DuckduckgoSearchService} from "./duckduckgoSearch.service";
import { getWordAndTokenCount } from '../utils/utils';
import { PageScraperService } from './pageScraper.service';
const TurndownService = require('turndown');

@Injectable()
export class WebsearchService {
    private abortControllers: Map<string, { controller: AbortController }> = new Map();
    constructor(private readonly modelsService: ModelsService,
                private readonly duckduckgoSearchService: DuckduckgoSearchService,
                private readonly pageScraperService: PageScraperService) {
    }

    async streamSearch(query: string, maxPages=3, startPage=1, ): Promise<Observable<string>> {
        const searchResultsSubject = new Subject<string>();
        this.duckduckgoSearchService.searchDuckDuckGoStream(query, searchResultsSubject, maxPages, startPage);
        return searchResultsSubject.asObservable();
    }

    async search(query: string, maxPages=3, startPage=1, ): Promise<SearchResultResponse> {
        return this.duckduckgoSearchService.searchDuckDuckGoStream(query, undefined, maxPages, startPage);
    }

    async streamAiSummaryOfUrl(memberId: string, url: string, searchQueryContext?: string){
        console.log(`streamAiSummaryOfUrl called for url:${url}`);
        const streamAiSummaryOfUrlSubject = new InferenceSSESubject();
        //allow a mechanism to cancel the request.
        const controller = new AbortController();
        this.abortControllers.set(memberId, {controller});
        const model = await this.modelsService.getModelByIdOrGetDefault(memberId);
        if (controller.signal.aborted) {
            console.log(`1 Request aborted before processing for memberId: ${memberId}`);
            await streamAiSummaryOfUrlSubject.sendCompleteOnNextTick();
            return streamAiSummaryOfUrlSubject.getSubject();
        }
        const r = await this.getMarkdownAndTokenCountsForUrlForWebSummaryUse(url);
        const {markdown} = r;

        const prompt = markdownWebPagePrompt(markdown, searchQueryContext);
        // const prompt = markdownWithoutVowelsWebPagePrompt(markdownWithoutVowels, searchQueryContext);

        if (controller.signal.aborted) {
            console.log(`2 Request aborted before processing for memberId: ${memberId}`);
            await streamAiSummaryOfUrlSubject.sendCompleteOnNextTick();
            return streamAiSummaryOfUrlSubject.getSubject();
        }
        // console.log(`prompt: `, prompt);
        this.callOpenAiUsingModelAndSubject([{role: 'system', content: prompt}],
          model, memberId, controller, streamAiSummaryOfUrlSubject);

        return streamAiSummaryOfUrlSubject.getSubject();
    }

    callOpenAiUsingModelAndSubject(openAiMessages: ChatCompletionMessageParam[], model: Model, memberId: string, abortController: AbortController, subject: InferenceSSESubject) {
        console.log(`websearch sending message to openai server model`);
        const apiKey = model.apiKey;
        const baseURL = model.url;
        const openai = new OpenAI({ apiKey, baseURL,});
        let completeText = '';
        const signal = abortController.signal;
        //call open ai
        openai.chat.completions
          .create({ model: model.modelName, messages: openAiMessages, stream: true,}, {signal})
          .then(async (stream) => {
              for await (const chunk of stream) {
                  const content = chunk.choices[0]?.delta?.content || '';
                  if (content) {
                      completeText += content;
                      subject.sendText(content);
                  }
              }
              this.abortControllers.delete(memberId);
              subject.sendComplete();
          })
          .catch((error) => {
              console.log(`openai error: `, error);
              this.abortControllers.delete(memberId);
              subject.sendError(error);
          });
    }

    async stop(memberId: string){
        const associatedAbortController = this.abortControllers.get(memberId);
        if(!associatedAbortController){
            return console.log(`no associated abort controller for member id: ${memberId}`);
        }
        console.log(`aborting controller`)
        associatedAbortController.controller.abort();
        this.abortControllers.delete(memberId);
    }

    /**
     * History of Rome wikipedia page is 55k tokens, and takes qwen2.5 8B 1million 1:40 seconds to summarize.
     * @param url
     */
    async getMarkdownAndTokenCountsForUrlForWebSummaryUse(url: string): Promise<GetPageContentsResponse>{
        const markdown = await this.pageScraperService.getContentsOfWebpageAsMarkdown({url, removeScriptsAndStyles: true,
            shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true});
        const {wordCount, tokenCount} = getWordAndTokenCount(markdown);
        return { markdown, wordCount, tokenCount };
    }
}
