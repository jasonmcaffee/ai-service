import { Injectable } from '@nestjs/common';
import {
  ChatCompletionAssistantMessageParam, ChatCompletionChunk,
  ChatCompletionMessageParam, ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

import { Model } from '../models/api/conversationApiModels';
import InferenceSSESubject from '../models/InferenceSSESubject';
import OpenAI from 'openai';
import ToolCall = ChatCompletionChunk.Choice.Delta.ToolCall;
import { AiFunctionContext, AiFunctionContextV2, AiFunctionExecutor } from '../models/agent/aiTypes';
import { toolCallEndMarker, toolCallStartMarker } from '../utils/prompts';
import { InvalidToolCallJsonFromLLM } from '../models/Exceptions';

interface CallOpenAiParams {
  openAiMessages: ChatCompletionMessageParam[];
  model: Model;
  totalOpenAiCallsMade?: number;
  aiFunctionContext: AiFunctionContextV2;
}

@Injectable()
export class OpenaiWrapperServiceV2{

  /**
   * The tool handling was mainly written by Claude 3.5 and 3.7, and the code deals with the tedious task of:
   * - using streaming, but also handling tool calls, which are streamed.
   * -- This gives this function versatility in that the same function can be called in scenarios where streaming is wanted sometimes, and so are tool calls. e.g. user chat prompt triggers a tool call.
   * - handling tool calls from llama.cpp, which do not come back in the same format as openai.  e.g. it's just a list of tool calls streamed back as text: <tool_call>{...} </tool_call>
   * @returns a promise which completes when all processing is finished.  Useful for scenarios where we don't need streaming, and just want the complete results.
   */
  async callOpenAiUsingModelAndSubject({
         openAiMessages,
         model,
         totalOpenAiCallsMade = 0,
         aiFunctionContext,
       }: CallOpenAiParams): Promise<{ openAiMessages: ChatCompletionMessageParam[], completeText: string, totalOpenAiCallsMade: number }> {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL });
    const signal = aiFunctionContext.abortController?.signal;

    try {
      totalOpenAiCallsMade += 1;
      const response = await openai.chat.completions.create({
        model: model.modelName,
        messages: openAiMessages,
        tools: aiFunctionContext.aiFunctionExecutor?.getToolsMetadata(),
        stream: false,
      }, { signal });

      const assistantMessage = response.choices[0].message;
      if(assistantMessage.content !== null){
        console.log('assistant message content not null.')
      }
      const parsedToolCalls = parseToolCallsDueToOccasionalIssueOfLlamaCppNotRespondingWithJson(assistantMessage.content);
      if(parsedToolCalls){
        assistantMessage.content = null;
        assistantMessage.tool_calls = parsedToolCalls;
      }

      // Add the assistant's message to our conversation
      openAiMessages.push({
        role: 'assistant' as const,
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls
      });
      const toolCallsFromOpenAi = assistantMessage.tool_calls;
      if(toolCallsFromOpenAi){
        const newOpenAiMessages = await handleAiToolCallMessagesByExecutingTheToolAndReturningTheResults(toolCallsFromOpenAi, aiFunctionContext);
        openAiMessages.push(...newOpenAiMessages);
        // Make a recursive call to continue the conversation and return its result
        return this.callOpenAiUsingModelAndSubject({ openAiMessages, model, totalOpenAiCallsMade, aiFunctionContext, });
      }else {
        aiFunctionContext.inferenceSSESubject?.sendComplete();
        const completeText = response.choices[0].message.content ?? '';
        // Return the final state
        return { openAiMessages, completeText, totalOpenAiCallsMade };
      }
    } catch (error) {
      //TODO: retry InvalidToolCallJsonFromLLM.

      console.error(`LLM error: `, error);
      aiFunctionContext.inferenceSSESubject?.sendError(error);
      return { openAiMessages, completeText: `error: ${error}`, totalOpenAiCallsMade };
    }
  }

  //stream version. careful llama.cpp doesn't support stream + tools yet.
  async callOpenAiUsingModelAndSubjectStream({
                                         openAiMessages,
                                         model,
                                         totalOpenAiCallsMade = 0,
                                         aiFunctionContext,
                                       }: CallOpenAiParams): Promise<{ openAiMessages: ChatCompletionMessageParam[], completeText: string, totalOpenAiCallsMade: number }> {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL });
    const signal = aiFunctionContext.abortController?.signal;
    let completeText = '';
    let assistantMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content: '',
      tool_calls: []
    };

    try {
      totalOpenAiCallsMade += 1;
      const stream = await openai.chat.completions.create({
        model: model.modelName,
        messages: openAiMessages,
        tools: aiFunctionContext.aiFunctionExecutor?.getToolsMetadata(), //TODO: should you be sending tools every single time? probably not.
        stream: true,
      }, { signal });

      for await (const chunk of stream) {
        // Extract content from the chunk
        const contentDelta = chunk.choices[0]?.delta?.content || '';
        if (contentDelta) {
          completeText += contentDelta;
          assistantMessage.content = completeText;

          // Send the chunk to the SSE subject for real-time updates
          aiFunctionContext.inferenceSSESubject?.sendText(contentDelta);
        }

        // Handle tool calls which may come in chunks
        if (chunk.choices[0]?.delta?.tool_calls) {
          const toolCallsDelta = chunk.choices[0].delta.tool_calls;

          // Initialize the tool_calls array if it doesn't exist
          if (!assistantMessage.tool_calls || !Array.isArray(assistantMessage.tool_calls)) {
            assistantMessage.tool_calls = [];
          }

          // Process each tool call in the delta
          for (const toolCallDelta of toolCallsDelta) {
            const { index, id, function: func } = toolCallDelta;

            // If this is a new tool call, add it to our array
            if (index !== undefined && !assistantMessage.tool_calls[index]) {
              assistantMessage.tool_calls[index] = {
                id: id || `call_${index}`,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }

            // Update the existing tool call with new data
            if (index !== undefined && func) {
              const currentToolCall = assistantMessage.tool_calls[index] as any;
              if (func.name) currentToolCall.function.name = func.name;
              if (func.arguments) currentToolCall.function.arguments += func.arguments;
            }
          }
        }
      }

      // Add the assistant's message to our conversation
      openAiMessages.push(assistantMessage);

      const toolCallsFromOpenAi = assistantMessage.tool_calls;
      if(toolCallsFromOpenAi && toolCallsFromOpenAi.length > 0){
        const newOpenAiMessages = await handleAiToolCallMessagesByExecutingTheToolAndReturningTheResults(toolCallsFromOpenAi, aiFunctionContext);
        openAiMessages.push(...newOpenAiMessages);
        // Make a recursive call to continue the conversation and return its result
        return this.callOpenAiUsingModelAndSubject({ openAiMessages, model, totalOpenAiCallsMade, aiFunctionContext, });
      }else {
        aiFunctionContext.inferenceSSESubject?.sendComplete();
        // Return the final state
        return { openAiMessages, completeText, totalOpenAiCallsMade };
      }

    } catch (error) {
      console.error(`LLM error: `, error);
      aiFunctionContext.inferenceSSESubject?.sendError(error);
      return { openAiMessages, completeText: `error: ${error}`, totalOpenAiCallsMade };
    }
  }
}

async function handleAiToolCallMessagesByExecutingTheToolAndReturningTheResults(toolCallsFromOpenAi: ChatCompletionMessageToolCall[], aiFunctionContext: AiFunctionContextV2): Promise<ChatCompletionMessageParam[]> {
  const openAiMessages: ChatCompletionMessageParam[] = [];
  for (const toolCall of toolCallsFromOpenAi) {
    try {
      const toolResponse = await handleAiToolCallMessageByExecutingTheToolAndReturningTheResult(toolCall, aiFunctionContext);

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
      throw error;
    }
  }
  return openAiMessages;
}

function parseToolCallsDueToOccasionalIssueOfLlamaCppNotRespondingWithJson(assistantContentResponse: string | null): ChatCompletionMessageToolCall[] | undefined {
  if(!assistantContentResponse){ return undefined; }
  // const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs; // doesn't match when there are new lines.
  const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g; // Matches everything inside <tool_call>...</tool_call>, including newlines
  const toolCalls: ChatCompletionMessageToolCall[] = [];

  // Find all tool_calls within the response content
  const matches = assistantContentResponse.match(toolCallRegex);

  if (matches) {
    // For each match, extract the JSON and parse it
    matches.forEach((match) => {
      const jsonStr = match.replace(/<tool_call>|<\/tool_call>/g, ''); // remove the <tool_call> tags
      try {
        const parsedJson =  JSON.parse(jsonStr); // parse the JSON string
        toolCalls.push(parsedJson); // add to the tool_calls array
      } catch (e) {
        console.error('Error parsing tool_call JSON:', e);
        throw new InvalidToolCallJsonFromLLM(e.message); //TODO: retry.
      }
    });
  }
  return toolCalls.length > 0 ? toolCalls : undefined;
}

async function handleAiToolCallMessageByExecutingTheToolAndReturningTheResult(toolCall: ChatCompletionMessageToolCall, aiFunctionContext: AiFunctionContextV2): Promise<{ tool_response: { name: string; content: any } } | null> {
  const {inferenceSSESubject: subject, aiFunctionExecutor: toolService} = aiFunctionContext;
  if(!toolService){
    throw new Error('no toolsService/aiFunctionExecutor');
  }
  try {
    const { toolName, toolArgs } = parseToolNameAndArgumentsFromToolCall(toolCall);
    // console.log(`Handling tool call: ${toolName} with args:`, toolArgs);

    if (typeof toolService[toolName] == 'function') {
      const result = await toolService[toolName](toolArgs, aiFunctionContext);
      return {
        tool_response: {
          name: toolName,
          content: result.result,
        }
      }
    } else {
      throw new Error(`No matching tool function found for: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling tool call:', error);
    subject?.sendError(error);
    throw error;
  }
  return null;
}

function parseToolNameAndArgumentsFromToolCall(toolCall: ChatCompletionMessageToolCall){
  const toolName = toolCall.function?.name!;
  const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
  return {
    toolName, toolArgs,
  };
}

