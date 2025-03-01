import { Injectable } from '@nestjs/common';
import {
  ChatCompletionAssistantMessageParam, ChatCompletionChunk,
  ChatCompletionMessageParam, ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { Model } from '../models/api/conversationApiModels';
import InferenceSSESubject from '../models/InferenceSSESubject';
import OpenAI from 'openai';
import { chatPageSystemPrompt } from '../utils/prompts';
import { LlmToolsService } from './llmTools.service';
import ToolCall = ChatCompletionChunk.Choice.Delta.ToolCall;

interface CallOpenAiParams {
  openAiMessages: ChatCompletionMessageParam[];
  handleOnText: (text: string) => void;
  handleResponseCompleted: (text: string, model: Model) => void;
  handleError: (error: any) => void;
  model: Model;
  memberId: string;
  inferenceSSESubject: InferenceSSESubject;
  abortController: AbortController;
  toolService: any; // service with tool functions.
  tools?: ChatCompletionTool[];
  shouldImmediatelyCallToolServiceFunctionWhenAiAsks: boolean;
}

@Injectable()
export class OpenaiWrapperService{

  async callOpenAiUsingModelAndSubject({
       openAiMessages,
       handleOnText,
       handleResponseCompleted,
       handleError,
       model,
       memberId,
       inferenceSSESubject,
       abortController,
       toolService,
       tools,
      shouldImmediatelyCallToolServiceFunctionWhenAiAsks = true,
     }: CallOpenAiParams) {
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

          const result = parseLlamaCppToolCalls(streamedText, completeText, accumulatedToolCalls, assistantResponse);
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
          if (shouldImmediatelyCallToolServiceFunctionWhenAiAsks && needsRecursiveCall && assistantResponse && Object.keys(accumulatedToolCalls).length > 0) {
            // Break out of the loop, we'll process tool calls
            break;
          }
        }
      }

      // Process tool calls if needed
      if (needsRecursiveCall && assistantResponse && Object.keys(accumulatedToolCalls).length > 0) {
        // Add tool calls to the assistant message
        // (assistantResponse.tool_calls as any[]) = Object.values(accumulatedToolCalls).map(toolCall => toolCall);
        assistantResponse.tool_calls  = Object.values(accumulatedToolCalls) as ChatCompletionMessageToolCall[];//same type definition
        // Add the assistant message to the conversation history
        openAiMessages.push(assistantResponse);

        // Process each tool call
        let index = 0;
        for (const toolCall of Object.values(accumulatedToolCalls)) {
          try {
            const toolResponse = await handleAiToolCallMessageByExecutingTheToolAndReturningTheResult(toolCall, toolService, inferenceSSESubject);

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
            handleError(error);
          }
          index++;
        }

        // Make a recursive call to continue the conversation
        return this.callOpenAiUsingModelAndSubject({
          openAiMessages,
          handleOnText,
          handleResponseCompleted,
          handleError,
          model,
          memberId,
          inferenceSSESubject,
          abortController,
          toolService,
          tools,
          shouldImmediatelyCallToolServiceFunctionWhenAiAsks
        });
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


}

async function handleAiToolCallMessageByExecutingTheToolAndReturningTheResult(toolCall: ToolCall, llmToolsService: LlmToolsService, subject: InferenceSSESubject): Promise<{ tool_response: { name: string; content: any } } | null> {
  try {
    const { toolName, toolArgs } = parseToolNameAndArgumentsFromToolCall(toolCall);
    console.log(`Handling tool call: ${toolName} with args:`, toolArgs);

    if (typeof llmToolsService[toolName] == 'function') {
      const result = await llmToolsService[toolName](toolArgs, subject);
      return {
        tool_response: {
          name: toolName,
          content: result,
        }
      }
    } else {
      throw new Error(`No matching tool function found for: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling tool call:', error);
    subject.sendError(error);
    throw error;
  }
  return null;
}

function parseToolNameAndArgumentsFromToolCall(toolCall: ToolCall){
  const toolName = toolCall.function?.name!;
  const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
  return {
    toolName, toolArgs,
  };
}
/**
 * Parse llama.cpp style tool calls from streamed content.
 * When llama.cpp sends back tool calls, it does so in the format:
 * <tool_call>
 * {"name": "searchWeb", "arguments": {"query": "gene hackman news"}}
 * </tool_call>
 * <tool_call>
 * {"name": "searchWeb", "arguments": {"query": "tame impala news"}}
 * </tool_call>
 *
 * This function is called over and over again as text is streamed back from the llm, so we have to ensure we don't parse the same
 * <tool_call> more than once.
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

  // Keep track of processed tool calls by their content to avoid duplicates
  const processedToolCallContents = new Set(
    Object.values(accumulatedToolCalls).map(tc =>
      //@ts-ignore
      tc.function.arguments
    )
  );

  // Find all tool calls in the accumulated streamed text
  while ((match = toolCallRegex.exec(streamedText)) !== null) {
    // Add text before the tool call to the display text
    newTextToDisplay += streamedText.substring(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    // Process the tool call
    try {
      const toolCallContent = match[1].trim();

      // Skip if we've already processed this exact tool call
      let parsedContent;
      try {
        parsedContent = JSON.parse(toolCallContent);
        const toolCallSignature = typeof parsedContent.arguments === 'string'
          ? parsedContent.arguments
          : JSON.stringify(parsedContent.arguments);

        // Skip this tool call if we've already processed it
        if (processedToolCallContents.has(toolCallSignature)) {
          continue;
        }

        processedToolCallContents.add(toolCallSignature);
      } catch (parseError) {
        console.error(`Error parsing tool call JSON: ${parseError}`);
        continue;
      }

      foundToolCalls = true;

      // Create unique ID for this tool call
      const toolId = `tool-${Date.now()}-${Object.keys(accumulatedToolCalls).length + Object.keys(newToolCalls).length}`;

      // Initialize assistant message if needed
      if (!updatedAssistantResponse) {
        updatedAssistantResponse = {
          role: 'assistant',
          content: null,
          tool_calls: []
        };
      }

      // Add to new tool calls
      const index = Object.keys(accumulatedToolCalls).length + Object.keys(newToolCalls).length;
      newToolCalls[index.toString()] = {
        index: index,
        id: toolId,
        type: 'function',
        function: {
          name: parsedContent.name || '',
          arguments: typeof parsedContent.arguments === 'string'
            ? parsedContent.arguments
            : JSON.stringify(parsedContent.arguments)
        }
      };
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
