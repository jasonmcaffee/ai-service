import {Injectable} from "@nestjs/common";
import { GetPageContentsResponse, Model, SearchResultResponse, } from '../models/api/conversationApiModels';
import { Observable, Subject } from 'rxjs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { markdownWebPagePrompt } from '../utils/prompts';
import { ModelsService } from './models.service';
import InferenceSSESubject from '../models/InferenceSSESubject';
import {DuckduckgoSearchService} from "./duckduckgoSearch.service";
import { getWordAndTokenCount } from '../utils/utils';
import { PageScraperService } from './pageScraper.service';
import { ClientAbortedError } from '../models/Exceptions';

@Injectable()
export class WebsearchService {
    private abortControllers: Map<string, { controller: AbortController }> = new Map();
    constructor(private readonly modelsService: ModelsService,
                private readonly duckduckgoSearchService: DuckduckgoSearchService,
                private readonly pageScraperService: PageScraperService) {
    }

    /**
     * Search the web using duckduckgo.
     * Stream results back via rxjs subject so that it's streamed to the client via SSE
     * @param query - search query
     * @param maxPages - the number of pages to fetch from duckduckgo
     * @param startPage - starting page in duckduckgo's search results.
     */
    async streamSearch(query: string, maxPages=3, startPage=1, ): Promise<Observable<string>> {
        const searchResultsSubject = new Subject<string>();
        this.duckduckgoSearchService.searchDuckDuckGoStream(query, searchResultsSubject, maxPages, startPage);
        return searchResultsSubject.asObservable();
    }

    /**
     * Search without streaming results back.
     * @param query - search query
     * @param maxPages - the number of pages to fetch from duckduckgo
     * @param startPage - starting page in duckduckgo's search results.
     */
    async search(query: string, maxPages=3, startPage=1, ): Promise<SearchResultResponse> {
        return this.duckduckgoSearchService.searchDuckDuckGo(query, maxPages, startPage);
    }

    /**
     * Have AI summarize a url.
     * @param memberId
     * @param url
     * @param searchQueryContext - useful for telling AI what the initial search was, so that it can summarize with that query in mind.
     */
    async streamAiSummaryOfUrl(memberId: string, url: string, searchQueryContext?: string){
        console.log(`streamAiSummaryOfUrl called for url:${url}`);
        const streamAiSummaryOfUrlSubject = new InferenceSSESubject();

        try{
            //allow a mechanism to cancel the request.
            //check the status of the signal throughout the request and stop processing by throwing a ClientAbortedError, if applicable.
            const controller = new AbortController();
            this.abortControllers.set(memberId, {controller});

            //get the model
            const model = await this.modelsService.getModelByIdOrGetDefault(memberId);
            ensureSignalIsNotAborted(controller);

            const r = await this.getMarkdownAndTokenCountsForUrlForAiWebSummaryUse(url);
            const {markdown} = r;

            const prompt = markdownWebPagePrompt(markdown, searchQueryContext);
            ensureSignalIsNotAborted(controller);

            this.callOpenAiUsingModelAndSubject([{role: 'system', content: prompt}],
              model, memberId, controller, streamAiSummaryOfUrlSubject);
        }catch(e){
            //since this is initiated by the user, swallow the exception.
            if(e instanceof ClientAbortedError){
                console.log(`1 Request aborted before processing for memberId: ${memberId}`);
                streamAiSummaryOfUrlSubject.sendCompleteOnNextTick();
            }else{
                streamAiSummaryOfUrlSubject.sendError(e);
            }
        }
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
     * gets markdown content for given url, stripping superflous content (nav, images, etc) not needed by AI.
     * History of Rome wikipedia page is 55k tokens, and takes qwen2.5 8B 1million 1:40 seconds to summarize.
     * @param url
     */
    async getMarkdownAndTokenCountsForUrlForAiWebSummaryUse(url: string): Promise<GetPageContentsResponse>{
        const markdown = await this.pageScraperService.getContentsOfWebpageAsMarkdown({url, removeScriptsAndStyles: true,
            shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true});
        const {wordCount, tokenCount} = getWordAndTokenCount(markdown);
        return { markdown, wordCount, tokenCount };
    }

}

function ensureSignalIsNotAborted(controller: AbortController){
    if(controller.signal.aborted){
        throw new ClientAbortedError('User initiated stop request so discontinuing processing');
    }
}
