import {Injectable} from "@nestjs/common";
import {DuckduckgoSearchService} from "../../duckduckgoSearch.service";
import { SearchResultResponse, SearchResultWithMarkdownContentResponse } from '../../../models/api/conversationApiModels';
import { PageScraperService } from '../../pageScraper.service';
import { getWordAndTokenCount, uuid } from '../../../utils/utils';
import InferenceSSESubject from "../../../models/InferenceSSESubject";
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult, } from '../../../models/agent/aiTypes';
import { chatCompletionTool, extractChatCompletionToolAnnotationValues } from './aiToolAnnotations';
import {WebSearchAgent} from '../webSearchAgent.service';

@Injectable()
export class AgentsAsToolsService implements AiFunctionExecutor<AgentsAsToolsService>{
  constructor(private readonly webSearchAgent: WebSearchAgent) {}

  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiWebSearchAgent",
      description: `
        This agent is useful for all things related to searching the web, using a natural language interface.
        
        # searching the web.  
        Use a prompt to ask the web agent to search the web for a specific topic, query, etc.
        e.g. 'search the web for a recipe for chicken noodle soup.' 
        e.g. 'search the web the latest news on tariffs.'
        
        # retrieving information from a single web page.
        Use a prompt to ask the web agent to retrieve the contents
            `,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "prompt to give to the web search agent.",
          },
        },
        required: ["prompt"],
      },
    }
  })
  async aiWebSearchAgent({prompt}: {prompt?: string} = {prompt: undefined}, context: AiFunctionContextV2, ): Promise<AiFunctionResult>{
    const {inferenceSSESubject: subject} = context;
    const result = await this.webSearchAgent.handlePrompt(prompt);
    //set a maximum token length.
    return { result, context,};
  }

  getToolsMetadata(): ChatCompletionTool[] {
    return extractChatCompletionToolAnnotationValues(this);
  }

}
