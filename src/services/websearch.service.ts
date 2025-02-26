import config from '../config/config';
import {Injectable} from "@nestjs/common";
import { Model, SearchResult, SearchResultResponse } from '../models/api/conversationApiModels';
import {Browser, BrowserContext, Page} from 'playwright';
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
import { Observable, Subject, lastValueFrom } from 'rxjs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { markdownWebPagePrompt } from '../utils/prompts';
import { ModelsService } from './models.service';
import InferenceSSESubject from '../models/InferenceSSESubject';
import {DuckduckgoSearchService} from "./duckduckgoSearch.service";
const TurndownService = require('turndown');

@Injectable()
export class WebsearchService {
    private abortControllers: Map<string, { controller: AbortController }> = new Map();
    constructor(private readonly modelsService: ModelsService, private readonly duckduckgoSearchService: DuckduckgoSearchService) {
    }

    async streamSearch(query: string, maxPages=3, startPage=1, ): Promise<Observable<string>> {
        const searchResultsSubject = new Subject<string>();
        this.duckduckgoSearchService.searchDuckDuckGo(query, searchResultsSubject, maxPages, startPage);
        return searchResultsSubject.asObservable();
    }

    async search(query: string, maxPages=3, startPage=1, ): Promise<SearchResultResponse> {
        return this.duckduckgoSearchService.searchDuckDuckGo(query, undefined, maxPages, startPage);
    }

    async getFullHtmlPageContent(url: string){
        return getHtmlContentsOfUrl(url);
    }

    async getMarkdownContent(url: string){
        return getMarkdownContentsOfPage(url);
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
        const markdownForPage = await getMarkdownContentsOfPage(url);
        const prompt = markdownWebPagePrompt(markdownForPage, searchQueryContext);
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

        openai.chat.completions
          .create({
              model: model.modelName, //'gpt-4',
              messages: openAiMessages,
              stream: true,
          }, {signal})
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
}

async function getMarkdownContentsOfPage(url: string, removeScriptsAndStyles=true, browser?: Browser , context?: BrowserContext): Promise<string>{
    const turndownService = new TurndownService();
    const htmlContents = await getHtmlContentsOfUrl(url, removeScriptsAndStyles, browser, context);
    const markdown = turndownService.turndown(htmlContents);
    return markdown;
}

async function getHtmlContentsOfUrl(url: string, removeScriptsAndStyles=false, browser?: Browser , context?: BrowserContext): Promise<string> {
    const browser2 = browser ? browser : await chromium.launch();
    const context2 = context ? context : await browser2!.newContext();
    const page = await context2!.newPage();
    await page.goto(url, {
        waitUntil: 'domcontentloaded'
    });
    return await getHtmlContentsOfPage(page, removeScriptsAndStyles);
}

async function getHtmlContentsOfPage(page: Page, removeScriptsAndStyles=false){

    // Add a small delay to allow for CSR (adjust timing as needed)
    await page.waitForTimeout(500);

    // Remove all script and style tags using page.evaluate
    // Remove scripts and styles, then get only body content
    let bodyContent = '';
    if(removeScriptsAndStyles){
        bodyContent = await page.evaluate(() => {
            // Remove script tags
            const scripts = document.getElementsByTagName('script');
            while (scripts[0]) scripts[0].parentNode!.removeChild(scripts[0]);
            // Remove style tags
            const styles = document.getElementsByTagName('style');
            while (styles[0]) styles[0].parentNode!.removeChild(styles[0]);
            // Remove link tags with rel="stylesheet"
            const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
            styleLinks.forEach(link => link.parentNode!.removeChild(link));
            return document.body.innerHTML;
        });
    }else{
        bodyContent = await page.evaluate(() => {return  document.documentElement.outerHTML;});
    }

    // Get the entire HTML content
    // const htmlContent = await page.content();
    const htmlContent = bodyContent;
    return htmlContent;
}


