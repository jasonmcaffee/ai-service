import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import OpenAI from 'openai';
import { ConversationService } from './conversation.service';
import {Message, MessageContext, Model} from '../models/api/conversationApiModels';
// import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

import config from '../config/config';
import {
  createOpenAIMessagesFromMessages,
  extractMessageContextFromMessage,
  formatDeepSeekResponse
} from '../utils/utils';
import {chatPageSystemPrompt} from "../utils/prompts";
import { ModelsService } from './models.service';
import InferenceSSESubject from "../models/InferenceSSESubject";
import {LlmToolsService} from "./llmTools.service";
import ToolCall = ChatCompletionChunk.Choice.Delta.ToolCall;

@Injectable()
export class ChatService {
  //clientId to abortcontroller map so we can stop.
  private abortControllers: Map<string, { controller: AbortController }> = new Map();

  constructor(private readonly conversationService: ConversationService,
              private readonly modelsService: ModelsService,
              private readonly llmToolsService: LlmToolsService) {}


  /**
   * Use an observable to stream back text as it's received from the LLM.
   * @param prompt
   * @param memberId
   * @param conversationId
   * @param modelId
   * @param shouldSearchWeb
   */
  async streamInference(prompt: string, memberId: string, conversationId?: string, modelId?: string, shouldSearchWeb = false): Promise<Observable<string>> {
    console.log(`streamInference called. shouldSearchWeb: ${shouldSearchWeb}`);
    const messageContext = extractMessageContextFromMessage(prompt);
    const model = await this.getModelToUseForMessage(memberId, messageContext, modelId);
    //use rjx subject to send SSE updates to the client.
    const inferenceSSESubject = new InferenceSSESubject();
    //allow client to press stop button with abort controller.
    const abortController = new AbortController();
    this.abortControllers.set(memberId, {controller: abortController});
    if(conversationId){
      this.streamInferenceWithConversation(memberId, conversationId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb);
    }else { //eg. name the conversation?
      this.streamInferenceWithoutConversation(memberId, model, messageContext, inferenceSSESubject, abortController, shouldSearchWeb);
    }
    return inferenceSSESubject.getSubject();
  }

  /**
   * Stop current generation for the member id.  Assumes 1 generation per member at a time
   * @param memberId
   */
  async stop(memberId: string){
    const associatedAbortController = this.abortControllers.get(memberId);
    if(!associatedAbortController){
      return console.log(`no associated abort controller for member id: ${memberId}`);
    }
    console.log(`aborting controller`)
    associatedAbortController.controller.abort();
    this.abortControllers.delete(memberId);
  }

  private async getModelToUseForMessage(memberId: string, messageContext: MessageContext, modelId?: string){
    const modelIdForMessage = messageContext.models.length > 0 ? messageContext.models[0].id : modelId;
    return this.modelsService.getModelByIdOrGetDefault(memberId, modelIdForMessage);
  }

  async streamInferenceWithConversation(memberId: string, conversationId: string, model:Model,
                                        messageContext: MessageContext, inferenceSSESubject: InferenceSSESubject,
                                        abortController: AbortController, shouldSearchWeb: boolean){
    //add datasources to conversation
    for (let datasourceContext of messageContext.datasources) {
      await this.conversationService.addDatasourceToConversation(memberId, parseInt(datasourceContext.id), conversationId);
    }

    const messageText = messageContext.originalText; //store the original text, unaltered.  alter before sending out.  // messageContext.textWithoutTags;
    //add the prompt to the messages table
    await this.conversationService.addMessageToConversation(memberId, conversationId, {messageText, role: 'user'});
    //get all the messages in the conversation
    const conversation = await this.conversationService.getConversation(memberId, conversationId, true);
    if(!conversation){ throw new Error('Conversation not found'); }

    //send user messages without <datasource> and <model> text.
    conversation.messages?.filter(m => m.sentByMemberId === memberId)
      .forEach(m => m.messageText = extractMessageContextFromMessage(m.messageText).textWithoutTags)

    let openAiMessages = createOpenAIMessagesFromMessages(conversation.messages!);
    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [...createOpenAIMessagesFromMessages([modelInitialMessage]), ...openAiMessages]
    }

    const handleOnText = (text: string) => {};

    const handleResponseCompleted = async (completeResponse: string, model: Model) => {
      this.abortControllers.delete(memberId);
      console.log('handle response completed got: ', completeResponse);
      const formattedResponse = formatDeepSeekResponse(completeResponse);
      await this.conversationService.addMessageToConversation(model.id, conversationId, {messageText: formattedResponse, role: 'system'}, false);
    }

    const tools = shouldSearchWeb ? getWebSearchTools() : [];

    console.log(`sending messages: `, openAiMessages);
    console.log(`sending tools: `, tools);
    const handleError = (error: any) =>{
      this.abortControllers.delete(memberId);
    };
    callOpenAiUsingModelAndSubject(openAiMessages, handleOnText, handleResponseCompleted, handleError, model, memberId, inferenceSSESubject, abortController, this.llmToolsService, tools);
  }

  async streamInferenceWithoutConversation(memberId: string, model: Model, messageContext: MessageContext,
                                           inferenceSSESubject: InferenceSSESubject, abortController: AbortController,
                                           shouldSearchWeb: boolean){
    const prompt = messageContext.textWithoutTags;
    const userMessage = {messageText: prompt, sentByMemberId: memberId, messageId: '', createdDate: '', role: 'user'};
    let openAiMessages = createOpenAIMessagesFromMessages([userMessage]);
    if(model.initialMessage){
      const modelInitialMessage = {messageText: model.initialMessage, sentByMemberId: model.id.toString(), messageId: '', createdDate: '', role: 'system'};
      openAiMessages = [...createOpenAIMessagesFromMessages([modelInitialMessage]), ...openAiMessages];
    }
    const tools = shouldSearchWeb ? getWebSearchTools() : [];
    const handleError = (error: any) =>{
      this.abortControllers.delete(memberId);
    };
    const handleOnComplete = () => {
      this.abortControllers.delete(memberId);
    }
    callOpenAiUsingModelAndSubject(openAiMessages, ()=>{}, handleOnComplete, handleError, model, memberId, inferenceSSESubject, abortController, this.llmToolsService, tools);

  }

}

async function callOpenAiUsingModelAndSubject(
  openAiMessages: ChatCompletionMessageParam[],
  handleOnText: (text: string) => void,
  handleResponseCompleted: (text: string, model: Model) => void,
  handleError: (error: any) => void,
  model: Model,
  memberId: string,
  inferenceSSESubject: InferenceSSESubject,
  abortController: AbortController,
  toolService: any, //service with tool functions.
  tools?: ChatCompletionTool[]
) {
  const apiKey = model.apiKey;
  const baseURL = model.url;
  const openai = new OpenAI({ apiKey, baseURL });
  const signal = abortController.signal;
  let completeText = '';
  let streamedText = '';

  // Track accumulated tool calls
  const accumulatedToolCalls: Record<string, ToolCall> = {};

  try {
    const stream = await openai.chat.completions.create({
      model: model.modelName,
      messages: [{ role: 'system', content: chatPageSystemPrompt }, ...openAiMessages],
      tools,
      stream: true,
    }, { signal });

    // Track if we need to make a recursive call
    let needsRecursiveCall = false;
    // Store assistant's response for the recursive call
    let assistantResponse: ChatCompletionAssistantMessageParam | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];

      // Handle standard OpenAI tool calls
      if (choice?.delta?.tool_calls) {
        needsRecursiveCall = true;

        // Initialize assistant message if needed
        assistantResponse = assistantResponse || { role: 'assistant', content: null, tool_calls: [] };

        for (const toolCall of choice.delta.tool_calls) {
          if (!toolCall.index && toolCall.index !== 0) continue;

          const index = toolCall.index.toString();

          // Initialize if this is the first chunk for this tool call
          if (!accumulatedToolCalls[index]) {
            accumulatedToolCalls[index] = {
              index: toolCall.index,
              id: toolCall.id,
              type: toolCall.type,
              function: {
                name: '',
                arguments: ''
              }
            };
          }

          const accumulatedToolCall = accumulatedToolCalls[index]!;
          // Update the function info with new chunks
          if (toolCall.function) {
            if (toolCall.function.name) {
              accumulatedToolCall.function!.name = toolCall.function.name;
            }

            if (toolCall.function.arguments) {
              accumulatedToolCall.function!.arguments += toolCall.function.arguments;
            }
          }

          // Update ID and type if provided
          if (toolCall.id) {
            accumulatedToolCall.id = toolCall.id;
          }

          if (toolCall.type) {
            accumulatedToolCall.type = toolCall.type;
          }
        }
      }

      // Handle streaming content, which might contain llama.cpp-style tool calls
      if (choice?.delta?.content) {
        const content = choice.delta.content;
        streamedText += content;

        const result = parseLlamaCppToolCalls(
          streamedText,
          completeText,
          accumulatedToolCalls,
          assistantResponse
        );

        // Get updated values from parsing result
        completeText = result.newTextToDisplay;

        // If we found tool calls, update our tracking variables
        if (result.foundToolCalls) {
          needsRecursiveCall = true;
          assistantResponse = result.assistantResponse;

          // Merge new tool calls into accumulated ones
          Object.assign(accumulatedToolCalls, result.newToolCalls);
        }

        // Stream any new content
        if (completeText !== result.previousCompleteText) {
          const newContent = completeText.substring(result.previousCompleteText.length);
          if (newContent) {
            await handleOnText(newContent);
            inferenceSSESubject.sendText(newContent);
          }
        }
      }

      // Check if we've reached the end of the stream
      if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop') {
        // If we have accumulated tool calls, proceed with handling them
        if (needsRecursiveCall && assistantResponse && Object.keys(accumulatedToolCalls).length > 0) {
          // Break out of the loop, we'll process tool calls
          break;
        }
      }
    }

    // Process tool calls if needed
    if (needsRecursiveCall && assistantResponse && Object.keys(accumulatedToolCalls).length > 0) {
      // Add tool calls to the assistant message
      (assistantResponse.tool_calls as any[]) = Object.values(accumulatedToolCalls).map(toolCall => ({
        id: toolCall.id,
        type: toolCall.type,
        function: {
          name: toolCall.function!.name,
          arguments: toolCall.function!.arguments
        }
      }));

      // Add the assistant message to the conversation history
      openAiMessages.push(assistantResponse);

      // Process each tool call
      let index = 0;
      for (const toolCall of Object.values(accumulatedToolCalls)) {
        try {
          const formattedToolCall = {
            index,
            function: {
              name: toolCall.function!.name,
              arguments: toolCall.function!.arguments
            }
          };

          const toolResponse = await handleOpenAiResponse(formattedToolCall, toolService, inferenceSSESubject);

          if (toolResponse) {
            // Add the tool response to messages - with correct structure
            openAiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id!,
              //@ts-ignore
              name: toolResponse.tool_response.name,
              content: JSON.stringify(toolResponse.tool_response.content)
            });
          }
        } catch (error) {
          console.error(`Error processing tool call: ${error}`);
        }
        index++;
      }

      // Make a recursive call to continue the conversation
      return callOpenAiUsingModelAndSubject(openAiMessages, handleOnText, handleResponseCompleted, handleError,
        model, memberId, inferenceSSESubject, abortController, toolService, tools);
    }

    // No tool calls or all tool calls processed, complete the response
    const endSignal = JSON.stringify({ end: 'true' });
    await handleResponseCompleted(completeText, model);
    handleOnText(endSignal);
    inferenceSSESubject.sendComplete();
  } catch (error) {
    console.error(`LLM error: `, error);
    handleError(error);
    inferenceSSESubject.sendError(error);
  }
}

/**
 * Parse llama.cpp style tool calls from streamed content
 * @param streamedText The accumulated streamed text
 * @param completeText The existing complete text without tool calls
 * @param accumulatedToolCalls The currently accumulated tool calls
 * @param assistantResponse The current assistant response object
 * @returns Object containing parsing results and updated values
 */
function parseLlamaCppToolCalls(
  streamedText: string,
  completeText: string,
  accumulatedToolCalls: Record<string, ToolCall>,
  assistantResponse: ChatCompletionAssistantMessageParam | null
): { newTextToDisplay: string; previousCompleteText: string; foundToolCalls: boolean; assistantResponse: ChatCompletionAssistantMessageParam | null; newToolCalls: Record<string, ToolCall>; } {
  // Copy the completeText to return as previous value
  const previousCompleteText = completeText;
  let newTextToDisplay = '';
  let foundToolCalls = false;
  const newToolCalls: Record<string, ToolCall> = {};

  // Initialize assistant response if needed
  let updatedAssistantResponse = assistantResponse;

  // Check for llama.cpp tool calls in the content
  const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
  let match;
  let lastIndex = 0;

  // Reset the regex to start from the beginning
  toolCallRegex.lastIndex = 0;

  // Find all tool calls in the accumulated streamed text
  while ((match = toolCallRegex.exec(streamedText)) !== null) {
    // Add text before the tool call to the display text
    newTextToDisplay += streamedText.substring(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    // Process the tool call
    try {
      const toolCallContent = match[1].trim();
      foundToolCalls = true;

      // Create unique ID for this tool call
      const toolId = `tool-${Date.now()}-${Object.keys(accumulatedToolCalls).length}`;

      // Initialize assistant message if needed
      if (!updatedAssistantResponse) {
        updatedAssistantResponse = {
          role: 'assistant',
          content: null,
          tool_calls: []
        };
      }

      try {
        const parsedContent = JSON.parse(toolCallContent);

        // Add to new tool calls
        const index = Object.keys(accumulatedToolCalls).length.toString();
        newToolCalls[index] = {
          index: parseInt(index),
          id: toolId,
          type: 'function',
          function: {
            name: parsedContent.name || '',
            arguments: typeof parsedContent.arguments === 'string'
              ? parsedContent.arguments
              : JSON.stringify(parsedContent.arguments)
          }
        };
      } catch (parseError) {
        console.error(`Error parsing tool call JSON: ${parseError}`);
      }
    } catch (error) {
      console.error(`Error processing tool call: ${error}`);
    }
  }

  // Add any remaining text after the last tool call to the display text
  newTextToDisplay += streamedText.substring(lastIndex);

  return {
    newTextToDisplay,
    previousCompleteText,
    foundToolCalls,
    assistantResponse: updatedAssistantResponse,
    newToolCalls
  };
}

function getWebSearchTools(): ChatCompletionTool[]{
  return [{
    type: "function",
    function: LlmToolsService.getSearchWebOpenAIMetadata(),
  }]
}

async function handleOpenAiResponse(toolCall: ToolCall, llmToolsService: LlmToolsService, subject: InferenceSSESubject): Promise<{ tool_response: { name: string; content: any } } | null> {
  try {
    const toolName = toolCall.function?.name!;
    const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');

    console.log(`Handling tool call: ${toolName} with args:`, toolArgs);

    if (typeof llmToolsService[toolName] == 'function') {
      const result = await llmToolsService[toolName](toolArgs, subject);
      return {
        tool_response: {
          name: toolName,
          content: result,
        }
      }
    }
    else {
      console.warn(`No matching tool function found for: ${toolName}`);
      subject.sendError(new Error(`No matching tool function found for: ${toolName}`));
      return null;
    }
  } catch (error) {
    console.error('Error handling tool call:', error);
    subject.sendError(error);
    throw error;
  }
  return null;
}


//from chatgpt
//data: 429 You exceeded your current quota
