import {Injectable} from "@nestjs/common";
import {DuckduckgoSearchService} from "../../duckduckgoSearch.service";
import { SearchResultResponse, SearchResultWithMarkdownContentResponse } from '../../../models/api/conversationApiModels';
import { PageScraperService } from '../../pageScraper.service';
import { getWordAndTokenCount, uuid } from '../../../utils/utils';
import InferenceSSESubject from "../../../models/InferenceSSESubject";
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult, } from '../../../models/agent/aiTypes';
import { chatCompletionTool, extractChatCompletionToolAnnotationValues } from './aiToolAnnotations';

@Injectable()
export class WebToolGetPageContentService implements AiFunctionExecutor<WebToolGetPageContentService>{
    constructor(private readonly pageScraperService: PageScraperService) {}

    @chatCompletionTool({
        type: "function",
        function: {
            name: 'aiGetContentsOfWebPageAsMarkdown',
            description: `Retrieves the contents of a web page, as markdown, via url so that an AI agent can do things like summarize, read, etc.
            Returns the contents of the page as markdown.  
            `,
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "The url to use in order to get the contents of a webpage as markdown.  Urls must begin with http or https e.g. https://wikipedia.com",
                    }
                }
            }
        }
    })
    async aiGetContentsOfWebPageAsMarkdown({url}: {url?: string} = {url: undefined}, context: AiFunctionContextV2, ): Promise<AiFunctionResult>{
        if(!url){ throw new Error('no url provided to aiGetContentsOfWebPage'); }
        const topicId = uuid();
        const {inferenceSSESubject: subject} = context;
        subject?.sendStatus({topicId, topic: 'web', displayText: `Page scraper is getting contents of url: ${url}`});
        try {
            const { markdown } = await this.pageScraperService.getContentsOfWebpageAsMarkdown({url: url, removeScriptsAndStyles: true, shortenUrls: true, cleanWikipedia: true, removeNavElements: true, removeImages: true, });
            const {tokenCount} = getWordAndTokenCount(markdown);
            subject?.sendStatus({topicId, topic: 'web', displayText: `Page scraper is done getting contents of url. Token count: ${tokenCount}`, topicCompleted: true});
            return {result: markdown, context};
        }catch(e){
            subject?.sendStatus({topicId, topic: 'web', displayText: `Page scraper encountered error when fetching url: ${url}: ${e.message}`, topicCompleted: true});
            return {result: `error getting url;; ${e.message}`, context};
        }

    }

    getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
    }

}
