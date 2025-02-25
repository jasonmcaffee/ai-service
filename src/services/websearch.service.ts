import config from '../config/config';
import {Injectable} from "@nestjs/common";
import { Model, SearchResult, SearchResultResponse } from '../models/api/conversationApiModels';
import {Browser, BrowserContext, Page} from 'playwright';
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();


import { Observable, Subject, lastValueFrom } from 'rxjs';
import {toArray} from 'rxjs/operators';
import { wait } from '../utils/utils';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { chatPageSystemPrompt, markdownWebPagePrompt } from '../utils/prompts';
import { ModelsService } from './models.service';
import InferenceSSESubject from '../models/InferenceSSESubject';
const TurndownService = require('turndown');

@Injectable()
export class WebsearchService {
    private abortControllers: Map<string, { controller: AbortController }> = new Map();
    private browser;
    constructor(private readonly modelsService: ModelsService) {

    }

    async streamSearch(query: string, maxPages=3, startPage=1, ): Promise<Observable<string>> {
        const searchResultsSubject = new Subject<string>();
        this.searchDuckDuckGo(query, searchResultsSubject, maxPages, startPage);
        return searchResultsSubject.asObservable();
    }

    async search(query: string, maxPages=3, startPage=1, ): Promise<SearchResultResponse> {
        return this.searchDuckDuckGo(query, undefined, maxPages, startPage);
    }

    private async searchDuckDuckGo(query: string, searchResultsSubject?: Subject<string>, maxPages=3, startPage=1, ): Promise<SearchResultResponse>{
        //duckduckgo has headless mode detection and throws an error.  use stealth to circumvent.
        chromium.use(stealth);
        this.browser = this.browser || await chromium.launch({
            args: ['--disable-blink-features=AutomationControlled'],
        });
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

        const context = await this.browser.newContext({
            userAgent,
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1
        });
        const page = await context.newPage();
        const allResults: SearchResult[] = [];
        try {
            // Navigate to DuckDuckGo and perform search
            await page.goto(`https://duckduckgo.com/?t=h_&q=${query}&ia=web`);

            // first go through and load all pages/results by click More button
            let currentPage = 1; //you must always start at 1 and click through More Results N times.  Just ignore results
            const lastPageToGet = startPage + maxPages;
            while (currentPage < lastPageToGet) {
                console.log(`getting page ${currentPage} of ${lastPageToGet}`);
                const hasMore = await clickMoreResultsAndWaitForCurrentPageNumberResultsToShowUp(currentPage, page);
                await wait(1000);
                if(currentPage >= startPage){
                    const newResults = await parseSearchResults(currentPage, page, searchResultsSubject);
                    allResults.push(...newResults);
                    console.log(`got ${newResults.length} for page: ${currentPage}`);
                }

                if (!hasMore) {
                    console.log('No more results available');
                    break;
                }
                currentPage++;
            }
            console.log(`total results: ${allResults.length}`);
            // console.log(JSON.stringify(allResults));
            // console.log('====================================================');
            // console.log(await getHtmlContentsOfPage(page) + '<style>svg{display:none;}</style>');

            searchResultsSubject?.next(JSON.stringify({end: true}));
            searchResultsSubject?.complete();
            return {
                searchResults: allResults,
                query
            }

        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        } finally {
            page.close();
            context.close();
            // await this.browser.close();  //leave it open.
        }
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

    callOpenAiUsingModelAndSubject(openAiMessages: ChatCompletionMessageParam[],
                                   model: Model,
                                   memberId: string,
                                   abortController: AbortController,
                                   subject: InferenceSSESubject
    ) {
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


async function clickMoreResultsAndWaitForCurrentPageNumberResultsToShowUp(currentPageNumber: number, page: Page): Promise<boolean> {
    try {
        if(currentPageNumber == 1){ return true; }
        // Wait for the button to be present, visible, and enabled
        await page.waitForSelector('button#more-results', { state: 'visible', timeout: 5000 });
        await page.click('button#more-results', { force: true });

        console.log(`waiting for page ${currentPageNumber} div to show up...`);
        await page.waitForSelector(`div[aria-label="Page ${currentPageNumber}"]`);
        console.log(`DONE waiting for page ${currentPageNumber} div to show up...`);

        return true;
    } catch (error) {
        console.warn('Failed to load more results:', error);
        return false;
    }
}

/**
 * Search results format:
 * <ol class="react-results--main">
 *   <li data-layout="organic" class="..."><article id="r1-9" data-handled-by-react="true" data-testid="result" data-nrn="result" class="..."><div class="..."><button type="button" class="..."><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor"><path d="M3.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM14 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path></g></svg></button><div class="BdZVYXbdg6Rx9Lrm5wzC"><svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="QmBU788gp3Cjs7Fwyz1G"><path fill="currentColor" d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293Z"></path></svg><p class="ePXqZzRA466zTvNP6hpa wZ4JdaHxSAhGy1HoNVja d26Geqs1C__RaCO7MUs2">cia.gov</p><div class="oDTE1nbHCw1Kax_TrCHw"><a href="?q=Greece%20site%3Awww.cia.gov" class="bcz7ZQmpP9fW9gyprTn7"><svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" class="sOgzQOS4liCVE5xXVnJT"><g fill="#000" fill-rule="evenodd" clip-path="url(#search-site-16_svg__a)" clip-rule="evenodd"><path d="M3.25 1A3.25 3.25 0 0 0 0 4.25v7.5A3.25 3.25 0 0 0 3.25 15H6a.75.75 0 0 0 0-1.5H3.25a1.75 1.75 0 0 1-1.75-1.75V5.5h13v1.75a.75.75 0 0 0 1.5 0v-3A3.25 3.25 0 0 0 12.75 1h-9.5Zm11.232 3H1.518A1.75 1.75 0 0 1 3.25 2.5h9.5A1.75 1.75 0 0 1 14.482 4Z"></path><path d="M7 10.75a3.75 3.75 0 1 1 6.879 2.068l1.901 1.902a.75.75 0 1 1-1.06 1.06l-1.902-1.901A3.75 3.75 0 0 1 7 10.75Zm3.75-2.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"></path></g><defs><clipPath id="search-site-16_svg__a"><path fill="#fff" d="M0 0h16v16H0z"></path></clipPath></defs></svg><span>Only include results for this site</span></a><a href="?q=Greece%20-site%3Awww.cia.gov" class="bcz7ZQmpP9fW9gyprTn7"><svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" class="sOgzQOS4liCVE5xXVnJT"><g clip-path="url(#eye-blocked-16_svg__a)"><path fill="#000" fill-rule="evenodd" d="M7.5 12.482c-3.278-.241-5.104-2.823-5.941-4.527C2.215 6.23 4.379 3.5 8 3.5c3.587 0 5.737 2.616 6.417 4.38a5 5 0 0 1 1.346.832c.073-.158.135-.307.188-.445l.09-.237-.072-.244C15.322 5.612 12.679 2 8 2 3.314 2 .678 5.69.033 7.779l-.084.273.12.26c.84 1.838 3.119 5.54 7.659 5.684A4.998 4.998 0 0 1 7.5 12.5zm3.488-4.75a5.012 5.012 0 0 0-3.255 3.256 3 3 0 1 1 3.255-3.255ZM16 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m-6-.5h5v1h-5z" clip-rule="evenodd"></path></g><defs><clipPath id="eye-blocked-16_svg__a"><path fill="#fff" d="M0 0h16v16H0z"></path></clipPath></defs></svg><span>Hide site from these results</span></a><div class="P0qXZSsYM5mY7vngloXE"></div><div class="bcz7ZQmpP9fW9gyprTn7"><svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" class="sOgzQOS4liCVE5xXVnJT"><path fill="#currentColor" fill-rule="evenodd" d="M0 4.25A3.25 3.25 0 0 1 3.25 1h9.5A3.25 3.25 0 0 1 16 4.25v4.5A3.25 3.25 0 0 1 12.75 12H9.884a1.4 1.4 0 0 0-.971.422c-1.506 1.48-3.202 2.617-4.314 3.289-1.09.659-2.264-.356-2.037-1.468a30 30 0 0 0 .384-2.246C1.17 11.917 0 10.433 0 8.75zM3.25 2.5A1.75 1.75 0 0 0 1.5 4.25v4.5c0 1.032.69 1.75 1.594 1.75.313 0 .626.116.864.286.221.158.56.505.514 1.028-.064.728-.23 1.667-.385 2.45 1.049-.65 2.495-1.655 3.773-2.912a2.9 2.9 0 0 1 2.023-.852h2.868A1.75 1.75 0 0 0 14.5 8.75v-4.5a1.75 1.75 0 0 0-1.75-1.75z" clip-rule="evenodd"></path></svg><span>Share feedback about this site</span></div></div></div></div><div class="OQ_6vPwNhCeusNiEDcGp"><div class="mwuQiMOjmFJ5vmN6Vcqw CmOawDMavJGKvqBIPeeC SgSTKoqQXa0tEszD2zWF VkOimy54PtIClAT3GMbr Aeo5DGrRAaTMRI5aKUH7 LQVY1Jpkk8nyJ6HBWKAk"><span class="DpVR46dTZaePK29PDkz8"><a href="/?q=Greece+site:www.cia.gov&amp;t=h_" rel="noopener" title="Search domain cia.gov" data-testid="result-extras-site-search-link" data-handled-by-react="true"><div class="c_ZIRTZwvW2k4q8TtKU0"><img src="//external-content.duckduckgo.com/ip3/www.cia.gov.ico" height="16" width="16" loading="lazy"></div></a></span><div class="pAgARfGNTRe_uaK72TAD"><p class="fOCEb2mA3YZTJXXjpgdS wZ4JdaHxSAhGy1HoNVja yGEuosa_aZeFroGMfpgu">CIA</p><a href="https://www.cia.gov/the-world-factbook/about/archives/2021/countries/greece/" rel="noopener" target="_self" data-testid="result-extras-url-link" data-handled-by-react="true" class="Rn_JXVtoPVAFyGkcaXyK VkOimy54PtIClAT3GMbr"><div class="xS2NxE06pIznLuh2xjH0"><p class="veU5I0hFkgFGOPhX2RBE wZ4JdaHxSAhGy1HoNVja AlPVsxUsFt3bnuOvg6hI"><span>https://www.cia.gov</span><span>&nbsp;›&nbsp;the-world-factbook › about › archives › 2021 › countries › greece</span></p></div></a></div></div></div><div class="ikg2IXiCD14iVX7AdZo1"><h2 class="LnpumSThxEWMIsDdAT17 CXMyPcQ6nDv47DKFeywM"><a href="https://www.cia.gov/the-world-factbook/about/archives/2021/countries/greece/" rel="noopener" target="_self" data-testid="result-title-a" data-handled-by-react="true" class="eVNpHGjtxRBq_gLOfGDr LQNqh2U1kzYxREs65IJu"><span class="EKtkFWMYpwzMKOYr0GYm LQVY1Jpkk8nyJ6HBWKAk">Greece - The World Factbook</span></a></h2></div><div class="E2eLOJr8HctVnDOTM8fs"><div data-result="snippet" class="OgdwYG6KE2qthn9XQWFC yjJptDoBkWgR0pBIOJNu"><div><span style="-webkit-line-clamp: 3;" class="kY2IgmnCmOGjharHErah"><span><b>Greece</b> achieved independence from the Ottoman Empire in 1830. During the second half of the 19th century and the first half of the 20th century, it gradually added neighboring islands and territories, most with Greek-speaking populations. In World War II, <b>Greece</b> was first invaded by Italy (1940) and subsequently occupied by Germany (1941-44 ...</span></span></div></div></div></article><div class="E4_TKgKL7YzziY_dW6E9"><div class="RPL9esU9f8nMDBntEfZQ"><div class="O9Ipab51rBntYb0pwOQn AgRvhDZlpjWsRz4nVQDb"><div class="qgEM63j36o5zaYOCmZkv"><div class="pQV_083vjW6_jcKh5cwA"><img src="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiB2aWV3Qm94PSIwIDAgOTYgOTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGggZmlsbD0iIzM5OUYyOSIgZD0iTTczLjMyNyA1MWMxLjU2IDAgMy4wMDctLjg5NyAzLjUwMi0yLjM3NkEyMi41NjYgMjIuNTY2IDAgMCAwIDc4IDQxLjQ0NEM3OCAyNy4zOTIgNjUuMDE2IDE2IDQ5IDE2aC00di4yNGMtMTQuMTIzIDEuNzEtMjUgMTIuMzQyLTI1IDI1LjIwNCAwIDguMzMgNC41NjMgMTUuNzI2IDExLjYxNyAyMC4zNjguODQ1LjU1NiAxLjE0IDEuNjcyLjYxNSAyLjUzM0wyOC4xNjkgNzFIMjUuNXYzaDRjLjEzMS0uMDAyLjI2Ni0uMDE4LjQwNC0uMDUgNC42LTEuMDcgMTIuMzQyLTIuOTUzIDE5LjQzMi01LjA1NyAxLjEyMy0uMzM0IDEuOTItMS4zMDYgMi4xODUtMi40NDdDNTMuNTgyIDU3LjU5NCA2MS41MiA1MSA3MSA1MWgyLjMyN1oiLz4KICA8cGF0aCBmaWxsPSIjNjNDODUzIiBkPSJNNzEuODg1IDUxQTIyLjY4NCAyMi42ODQgMCAwIDAgNzQgNDEuNDQ0Qzc0IDI3LjM5MiA2MS4wMTYgMTYgNDUgMTZTMTYgMjcuMzkyIDE2IDQxLjQ0NGMwIDguMzMgNC41NjMgMTUuNzI2IDExLjYxNyAyMC4zNjguODQ1LjU1NiAxLjE0IDEuNjcyLjYxNSAyLjUzM2wtNC4yNDggNi45NTdjLS44MjQgMS4zNS4zNyAzLjAwOSAxLjkyIDIuNjQ4IDUuODQzLTEuMzYgMTYuNzU4LTQuMDMgMjQuOTY0LTYuODAyLjMzNS0uMTEzLjU4MS0uMzk3LjY2Mi0uNzQyQzUzLjYwNiA1Ny41NzUgNjEuNTM1IDUxIDcxIDUxaC44ODVaIi8+CiAgPHBhdGggZmlsbD0iI0NDQyIgZD0iTTkyLjUwMSA1OWMuMjk4IDAgLjU5NS4xMi44MjMuMzU0LjQ1NC40NjguNDU0IDEuMjMgMCAxLjY5OGwtMi4zMzMgMi40YTEuMTQ1IDEuMTQ1IDAgMCAxLTEuNjUgMCAxLjIyNyAxLjIyNyAwIDAgMSAwLTEuNjk4bDIuMzMzLTIuNGMuMjI3LS4yMzQuNTI0LS4zNTQuODIyLS4zNTRoLjAwNVptLTEuMTY2IDEwLjc5OGgzLjQ5OWMuNjQxIDAgMS4xNjYuNTQgMS4xNjYgMS4yIDAgLjY2LS41MjUgMS4yLTEuMTY2IDEuMmgtMy40OTljLS42NDEgMC0xLjE2Ni0uNTQtMS4xNjYtMS4yIDAtLjY2LjUyNS0xLjIgMS4xNjYtMS4yWm0tMS45ODIgOC43NTRjLjIyNy0uMjM0LjUyNS0uMzU0LjgyMi0uMzU0aC4wMDZjLjI5NyAwIC41OTUuMTIuODIyLjM1NGwyLjMzMiAyLjRjLjQ1NS40NjcuNDU1IDEuMjMgMCAxLjY5N2ExLjE0NSAxLjE0NSAwIDAgMS0xLjY1IDBsLTIuMzMyLTIuNGExLjIyNyAxLjIyNyAwIDAgMSAwLTEuNjk3WiIvPgogIDxyZWN0IHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgeD0iNTUiIHk9IjU1IiBmaWxsPSIjREU1ODMzIiByeD0iMTYiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03MSA1Ny4wNDRjLTcuNzA4IDAtMTMuOTU2IDYuMjQ4LTEzLjk1NiAxMy45NTYgMCA3LjcwNyA2LjI0OCAxMy45NTYgMTMuOTU2IDEzLjk1NiA3LjcwNyAwIDEzLjk1Ni02LjI0OSAxMy45NTYtMTMuOTU2IDAtNy43MDgtNi4yNDktMTMuOTU2LTEzLjk1Ni0xMy45NTZaTTU4Ljk1NiA3MWMwLTYuNjUyIDUuMzkyLTEyLjA0NCAxMi4wNDQtMTIuMDQ0IDYuNjUxIDAgMTIuMDQ0IDUuMzkyIDEyLjA0NCAxMi4wNDQgMCA1Ljg5Mi00LjIzMiAxMC43OTYtOS44MjIgMTEuODQtMS40NTItMy4zMzYtMi45NjYtNy4zMy0xLjQ4NS03Ljc3Mi0xLjc2My0zLjE4LTEuNDA2LTUuMjY4IDIuMjU0LTQuNjI0aC4wMDVjLjQxLjA0Ny43MjEuMDgyLjgxOC4wMi40OTYtLjMxNS4xODktNy4yNDItNC4xMTQtOC4xODItMy45Ni00LjktNy43My42ODgtNS44MTcuMzA2IDEuNTI5LS4zODIgMi42NjUtLjAzIDIuNjEyLS4wMTQtNi43NTUuODUyLTMuNjE0IDExLjQ5NS0xLjg4IDE3LjM2OWE4Mi45IDgyLjkgMCAwIDEgLjYwNiAyLjExNmMtNC4yNzUtMS44NS03LjI2NS02LjEwNS03LjI2NS0xMS4wNTlaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz4KICA8cGF0aCBmaWxsPSIjNENCQTNDIiBkPSJNNzYuMjkgODEuMDljLS4wNDMuMjc0LS4xMzcuNDU3LS4zMDYuNDgyLS4zMTkuMDUtMS43NDctLjI3OC0yLjU2LS41ODctLjA5Mi40MjUtMi4yNjguODI3LTIuNjEzLjI1Ny0uNzkuNjgyLTIuMzAyIDEuNjczLTIuNjE5IDEuNDY1LS42MDUtLjM5Ni0xLjE3NS0zLjQ1LS43Mi00LjA5Ni42OTMtLjYzIDIuMTUuMDU1IDMuMTcxLjQxNy4zNDctLjU4NiAyLjAyNC0uODA4IDIuMzcyLS4zMjcuOTE3LS42OTcgMi40NDgtMS42OCAyLjU5Ny0xLjUwMS43NDUuODk3LjgzOSAzLjAzLjY3OCAzLjg5WiIvPgogIDxwYXRoIGZpbGw9IiNGQzMiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTY4LjUzIDcxLjg3Yy4zMTEtMi4yMTYgNC40OTYtMS41MjMgNi4zNjgtMS43NzJhMTIuMTEgMTIuMTEgMCAwIDAgMy4wNS0uNzU1YzEuNTQ3LS42MzYgMS44MTEtLjAwNSAxLjA1NC45ODUtMi4xMzYgMi41MzMtNi44ODkuNjktNy43NCAyLS4yNDguMzg4LS4wNTYgMS4zMDEgMS44OTkgMS41ODkgMi42NC4zODggNC44MS0uNDY4IDUuMDc5LjA1LS42MDMgMi43NjQtMTAuNjMgMS44MjMtOS43MTItMi4wOTdoLjAwMVoiIGNsaXAtcnVsZT0iZXZlbm9kZCIvPgogIDxwYXRoIGZpbGw9IiMxNDMwN0UiIGQ9Ik03My44NzEgNjUuNDhjLS4yNzctLjYtMS43LS41OTYtMS45NzItLjAyNC0uMDI1LjExOC4wNzUuMDg3LjI2My4wMjguMzMxLS4xMDQuOTM4LS4yOTUgMS42MzYuMDc4LjA1NS4wMjQuMTA5LS4wMzMuMDczLS4wODNabS02Ljk1NC4xNDNjLS4yNjQtLjAxOS0uNjkzLS4wNS0xLjA0OC4xNDctLjUyLjIyMi0uNjg4LjQ2LS43ODguNjI0LS4wMzcuMDYtLjE4MS4wNTQtLjE4MS0uMDE3LjAzNS0uOTU0IDEuNjUzLTEuNDE0IDIuMjQxLS44MjEuMDcyLjA4OS0uMDMzLjA4MS0uMjI0LjA2N1ptNi40NDcgMy4xOTljLTEuMDg4LS4wMDUtMS4wODgtMS42ODQgMC0xLjY5IDEuMDkuMDA2IDEuMDkgMS42ODUgMCAxLjY5Wm0tNS41MTctLjI2Yy0uMDIxIDEuMjk0LTEuOTIgMS4yOTQtMS45NCAwIC4wMDUtMS4yODkgMS45MzQtMS4yODggMS45NCAwWiIvPgogIDxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTMxIDQ2YTUgNSAwIDEgMCAwLTEwIDUgNSAwIDAgMCAwIDEwWm0xOS01YTUgNSAwIDEgMS0xMCAwIDUgNSAwIDAgMSAxMCAwWm0xNCAwYTUgNSAwIDEgMS0xMCAwIDUgNSAwIDAgMSAxMCAwWiIgY2xpcC1ydWxlPSJldmVub2RkIi8+Cjwvc3ZnPgo=" width="64" height="64" alt=""><div class="hmTYw13gNC5rRNjkDuoP"><h3 class="wZ4JdaHxSAhGy1HoNVja xrWcR15SIZQFwwZBfYi3">Can’t find what you’re looking for?</h3><p class="wZ4JdaHxSAhGy1HoNVja cPy9QU4brI7VQXFNPEvF">Help us improve DuckDuckGo searches with your feedback</p></div></div><div class="NGDdH6F4gUi6er8obQvd"><span data-testid="feedback-prompt"><span class="VYRn0PqcTApLnWYi0GKA"><button type="button" class="ffON2NH02oMAcqyoh2UU vcOFkrrvuSYp7xsAur2Y nWaOkxAPEk2W_43cmAki">Share Feedback</button></span></span></div></div></div></div></div></li>
 *   <li class="..."><div aria-label="Page 2" class="..."><span class="...">2</span><hr></div></li>
 * @param currentPageNumber
 * @param page
 * @param searchResultsSubject
 */
async function parseSearchResults(currentPageNumber: number, page: Page, searchResultsSubject?: Subject<string>): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Get all li elements within the search results list
    const searchResultLis = await page.$$('ol.react-results--main > li');

    // Find the boundaries for the current page
    let startIndex = 0;
    let endIndex = searchResultLis.length;

    if (currentPageNumber > 1) {
        // Find the li containing the current page number
        for (let i = 0; i < searchResultLis.length; i++) {
            // Check if this li has a div with aria-label
            const pageDiv = await searchResultLis[i].$('div[aria-label]');
            if (!pageDiv) continue;

            const pageLabel = await pageDiv.getAttribute('aria-label');

            if (pageLabel === `Page ${currentPageNumber}`) {
                startIndex = i + 1; // Start after the page indicator
            } else if (pageLabel === `Page ${currentPageNumber + 1}`) {
                endIndex = i; // End before the next page indicator
                break;
            }
        }
    }

    // Process only the lis for the current page
    for (let i = startIndex; i < endIndex; i++) {
        const li = searchResultLis[i];

        // Check if this li contains an article
        const article = await li.$('article[data-testid="result"]');
        if (!article) continue;

        try {
            // Title and URL extraction
            const title = await article.$eval('h2 a span',
              (el) => el.textContent?.trim() || '');

            const url = await article.$eval('h2 a',
              (el) => el.getAttribute('href') || '');

            // Get text content from all spans in the snippet area
            const snippetSpans = await article.$$eval('[data-result="snippet"] span > span',
              (elements) => elements.map(el => el.textContent?.trim() || ''));

            // Process the spans
            let date: string | undefined;
            let blurb: string;

            // Check if first span matches date pattern (e.g., "Jul 3, 2024")
            const datePattern = /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/;
            if (snippetSpans.length > 1 && datePattern.test(snippetSpans[0])) {
                date = snippetSpans[0];
                blurb = snippetSpans.slice(1).join(' ');
            } else {
                blurb = snippetSpans.join(' ');
            }

            const searchResult: SearchResult = { title, url, blurb, ...(date && { date }) };
            results.push(searchResult);
            searchResultsSubject?.next(JSON.stringify({data: {searchResults: [searchResult]}, end: false}));
        } catch (error) {
            console.warn('Failed to parse result:', error);
            continue;
        }
    }

    return results;
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


