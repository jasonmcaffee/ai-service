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
        this.duckduckgoSearchService.searchDuckDuckGoStream(query, searchResultsSubject, maxPages, startPage);
        return searchResultsSubject.asObservable();
    }

    async search(query: string, maxPages=3, startPage=1, ): Promise<SearchResultResponse> {
        return this.duckduckgoSearchService.searchDuckDuckGoStream(query, undefined, maxPages, startPage);
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
}

async function getMarkdownContentsOfPage(url: string, removeScriptsAndStyles=true, removeImages=true, shouldShortenUrl = true, browser?: Browser , context?: BrowserContext): Promise<string>{
    const turndownService = new TurndownService({
        // linkStyle: 'inlined', //prevent uneccesary new lines
    });
    const htmlContents = await getHtmlContentsOfUrl(url, removeScriptsAndStyles, removeImages, shouldShortenUrl, browser, context);
    const markdown = turndownService.turndown(htmlContents);
    return markdown;
}

async function getHtmlContentsOfUrl(url: string, removeScriptsAndStyles=false, removeImages=false, shouldShortenUrl = false, browser?: Browser , context?: BrowserContext): Promise<string> {
    const browser2 = browser ? browser : await chromium.launch();
    const context2 = context ? context : await browser2!.newContext();
    const page = await context2!.newPage();
    await page.goto(url, {
        waitUntil: 'domcontentloaded'
    });
    const result = await getHtmlContentsOfPage(page, removeScriptsAndStyles, removeImages, shouldShortenUrl);
    return result.html;
}

async function getHtmlContentsOfPage(
  page: Page,
  removeScriptsAndStyles = false,
  removeImages = false,
  shouldShortenUrl = false
) {
    // Add a small delay to allow for CSR (adjust timing as needed)
    await page.waitForTimeout(500);



    // Get the HTML content with optional modifications
    const result = await page.evaluate(
      (options) => {
          const { removeScriptsAndStyles, removeImages, shouldShortenUrl } = options;
          const shortenedUrlMap = new Map<string, string>();
          let urlCounter = 1;
          // let shortenedUrlMap = shouldShortenUrl ? new Map() : null;

          if (removeScriptsAndStyles) {
              // Remove script tags
              const scripts = document.getElementsByTagName('script');
              while (scripts[0]) scripts[0].parentNode!.removeChild(scripts[0]);

              // Remove style tags
              const styles = document.getElementsByTagName('style');
              while (styles[0]) styles[0].parentNode!.removeChild(styles[0]);

              // Remove link tags with rel="stylesheet"
              const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
              styleLinks.forEach(link => link.parentNode!.removeChild(link));
          }

          if (removeImages) {
              // Remove standard img tags
              const images = document.getElementsByTagName('img');
              while (images[0]) images[0].parentNode!.removeChild(images[0]);

              // Remove svg tags
              const svgs = document.getElementsByTagName('svg');
              while (svgs[0]) svgs[0].parentNode!.removeChild(svgs[0]);

              // Remove picture tags
              const pictures = document.getElementsByTagName('picture');
              while (pictures[0]) pictures[0].parentNode!.removeChild(pictures[0]);

              // Remove inline background images in style attributes
              const elementsWithStyle = document.querySelectorAll('[style*="background"]');
              elementsWithStyle.forEach(el => {
                  //@ts-ignore
                  if (el.style.backgroundImage) {
                      //@ts-ignore
                      el.style.backgroundImage = 'none';
                  }
              });

              // Remove image inputs
              const imageInputs = document.querySelectorAll('input[type="image"]');
              imageInputs.forEach(input => input.parentNode!.removeChild(input));

              // Remove objects with image/svg content
              const objects = document.querySelectorAll('object[type^="image/"], object[data^="data:image/"]');
              objects.forEach(obj => obj.parentNode!.removeChild(obj));

              // Remove embeds that might be images
              const embeds = document.querySelectorAll('embed[src*=".svg"], embed[src*=".png"], embed[src*=".jpg"], embed[src*=".jpeg"], embed[src*=".gif"], embed[src^="data:image/"]');
              embeds.forEach(embed => embed.parentNode!.removeChild(embed));

              // Remove canvas elements (which might contain images)
              const canvases = document.getElementsByTagName('canvas');
              while (canvases[0]) canvases[0].parentNode!.removeChild(canvases[0]);
          }

          if (shouldShortenUrl) {
              // Process all anchor tags with href attributes
              const links = document.querySelectorAll('a[href]');
              links.forEach(link => {
                  const originalUrl = link.getAttribute('href');

                  // Skip empty URLs, javascript: URLs, and already shortened URLs
                  if (!originalUrl ||
                    originalUrl.startsWith('javascript:') ||
                    originalUrl.startsWith('#') ||
                    /^\d+\.ai$/.test(originalUrl)) {
                      return;
                  }

                  // Create shortened URL
                  const shortenedUrl = `${urlCounter}.ai`;

                  // Store in map
                  shortenedUrlMap.set(shortenedUrl, originalUrl);

                  // Replace the URL in the HTML
                  link.setAttribute('href', shortenedUrl);

                  // Increment counter
                  urlCounter++;
              });
          }

          // Convert the Map to a regular object for serialization
          const shortenedUrlObject = shouldShortenUrl
            ? Object.fromEntries(shortenedUrlMap)
            : null;

          return {
              html: document.documentElement.outerHTML,
              shortenedUrlMap: shortenedUrlObject
          };
      },
      { removeScriptsAndStyles, removeImages, shouldShortenUrl }
    );

    // Return the formatted result
    return {
        html: result.html,
        shortenedUrlMap: result.shortenedUrlMap
    };
}


