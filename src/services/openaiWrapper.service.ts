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
import {AiFunctionContext, AiFunctionExecutor} from "../models/agent/aiTypes";
import { toolCallEndMarker, toolCallStartMarker } from '../utils/prompts';

interface CallOpenAiParams {
  openAiMessages: ChatCompletionMessageParam[];
  // handleOnText?: (text: string) => void;
  // handleResponseCompleted?: (text: string, model: Model) => void;
  // handleError?: (error: any) => void;
  model: Model;
  memberId: string;
  inferenceSSESubject?: InferenceSSESubject;
  abortController?: AbortController;
  toolService: AiFunctionExecutor<any>; // service with tool functions.
  tools?: ChatCompletionTool[];
  totalOpenAiCallsMade?: number;
  aiFunctionContext?: AiFunctionContext;
}

@Injectable()
export class OpenaiWrapperService{

  /**
   * The tool handling was mainly written by Claude 3.5 and 3.7, and the code deals with the tedious task of:
   * - using streaming, but also handling tool calls, which are streamed.
   * -- This gives this function versatility in that the same function can be called in scenarios where streaming is wanted sometimes, and so are tool calls. e.g. user chat prompt triggers a tool call.
   * - handling tool calls from llama.cpp, which do not come back in the same format as openai.  e.g. it's just a list of tool calls streamed back as text: <tool_call>{...} </tool_call>
   * @param openAiMessages
   * @param handleOnText
   * @param handleResponseCompleted
   * @param handleError
   * @param model
   * @param memberId
   * @param inferenceSSESubject
   * @param abortController
   * @param toolService
   * @param tools
   * @param totalOpenAiCallsMade
   * @param aiFunctionContext
   * @returns a promise which completes when all processing is finished.  Useful for scenarios where we don't need streaming, and just want the complete results.
   */
  async callOpenAiUsingModelAndSubject({
       openAiMessages,
       model,
       memberId,
       inferenceSSESubject,
       abortController,
       toolService, //todo: just use the aiFunctionContext.
       tools,
       totalOpenAiCallsMade = 0,
       aiFunctionContext = {inferenceSSESubject, aiFunctionExecutor: toolService, functionResults: {}},
     }: CallOpenAiParams): Promise<{ openAiMessages: ChatCompletionMessageParam[], completeText: string, totalOpenAiCallsMade: number }> {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL });
    const signal = abortController?.signal;
    let completeText = '';
    let streamedText = '';

    // Track accumulated tool calls
    const accumulatedToolCalls: Record<string, ToolCall> = {};

    try {
      totalOpenAiCallsMade += 1;
      const stream = await openai.chat.completions.create({
        model: model.modelName,
        messages: openAiMessages,
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

          // const result = {foundToolCalls: null, assistantResponse: null, previousCompleteText: completeText, newToolCalls: null};
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
              inferenceSSESubject?.sendText(newContent);
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
        assistantResponse.tool_calls = Object.values(accumulatedToolCalls) as ChatCompletionMessageToolCall[];
        // Add the assistant message to the conversation history
        openAiMessages.push(assistantResponse);

        // Process each tool call
        for (const toolCall of Object.values(accumulatedToolCalls)) {
          try {
            const toolResponse = await handleAiToolCallMessageByExecutingTheToolAndReturningTheResult(toolCall, toolService, aiFunctionContext);

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

        // Make a recursive call to continue the conversation and return its result
        return this.callOpenAiUsingModelAndSubject({
          openAiMessages,
          model,
          memberId,
          inferenceSSESubject,
          abortController,
          toolService,
          tools,
          totalOpenAiCallsMade,
          aiFunctionContext,
        });
      }

      // No tool calls or all tool calls processed, complete the response
      const endSignal = JSON.stringify({ end: 'true' });
      // if (handleResponseCompleted) {
      //   await handleResponseCompleted(completeText, model);
      // }
      // if (handleOnText) {
      //   handleOnText(endSignal);
      // }
      inferenceSSESubject?.sendComplete();

      // Return the final state
      return { openAiMessages, completeText, totalOpenAiCallsMade };
    } catch (error) {
      console.error(`LLM error: `, error);
      // if (handleError) {
      //   handleError(error);
      // }
      inferenceSSESubject?.sendError(error);

      // Even in case of error, return the current state
      return { openAiMessages, completeText, totalOpenAiCallsMade };
    }
  }

}

async function handleAiToolCallMessageByExecutingTheToolAndReturningTheResult(toolCall: ToolCall, toolService: AiFunctionExecutor<any>, aiFunctionContext: AiFunctionContext): Promise<{ tool_response: { name: string; content: any } } | null> {
  const {inferenceSSESubject: subject} = aiFunctionContext;
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

function parseToolNameAndArgumentsFromToolCall(toolCall: ToolCall){
  const toolName = toolCall.function?.name!;
  const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
  return {
    toolName, toolArgs,
  };
}

function createToolCallRegex(toolCallStartMarker, toolCallEndMarker) {
  // Escape special regex characters in the markers
  const escapedStartMarker = toolCallStartMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEndMarker = toolCallEndMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create regex with escaped markers
  return new RegExp(`${escapedStartMarker}\\s*([\\s\\S]*?)\\s*${escapedEndMarker}`, 'g');
}

/**
 *
 * NOTE!! THIS REQUIRES A CUSTOM TEMPLATE WITH LLAMA.CPP, due to <tool_call> tags not getting closed correctly.
 * SEE BOTTOM OF THIS FILE FOR THE TEMPLATE.
 *
 * This function is called over and over again as text is streamed back from the llm, so we have to ensure we don't parse the same
 * @param streamedText The accumulated streamed text
 * @param completeText The existing complete text without tool calls
 * @param accumulatedToolCalls The currently accumulated tool calls
 * @param assistantResponse The current assistant response object
 * @returns Object containing parsing results and updated values
 */
export function parseLlamaCppToolCalls(
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

    // const toolCallRegex = /\[Tool_Call_Start\]\s*([\s\S]*?)\s*\[Tool_End\]/g;
  const toolCallRegex = createToolCallRegex(toolCallStartMarker, toolCallEndMarker);
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
    const sub = streamedText.substring(lastIndex, match.index);
    newTextToDisplay += sub;
    lastIndex = match.index + match[0].length;
    // console.log(`lastIndex: ${lastIndex}, match.index: ${match.index} sub: ${sub}, newTextToDisplay: ${newTextToDisplay}, streamedText: ${streamedText}`)

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
        console.error(`Error parsing tool call JSON:`, parseError);
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
      throw error;
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


/**
 {%- if tools %}
    {{- '<|im_start|>system\n' }}
    {%- if messages[0]['role'] == 'system' %}
        {{- messages[0]['content'] }}
    {%- else %}
        {{- 'You are Qwen, created by Alibaba Cloud, with assistance from Jason. You are a helpful assistant.' }}
    {%- endif %}

    {{- "\n\n# Tools\n\n" }}
    {{- "You may use the following tools to help with user queries.\n\n" }}
    {{- "## Available Functions\n\n" }}
    {{- "<tools>\n" }}
    {%- for tool in tools %}
        {{- tool | tojson }}
        {{- "\n" }}
    {%- endfor %}
    {{- "</tools>\n\n" }}
    {{- "<|im_end|>\n" }}
{%- else %}
    {%- if messages[0]['role'] == 'system' %}
        {{- '<|im_start|>system\n' + messages[0]['content'] + '<|im_end|>\n' }}
    {%- else %}
        {{- '<|im_start|>system\nYou are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>\n' }}
    {%- endif %}
{%- endif %}
{%- for message in messages %}
    {%- if (message.role == "user") or (message.role == "system" and not loop.first) or (message.role == "assistant" and not message.tool_calls) %}
        {{- '<|im_start|>' + message.role + '\n' + message.content + '<|im_end|>' + '\n' }}
    {%- elif message.role == "assistant" %}
        {{- '<|im_start|>' + message.role }}
        {%- if message.content %}
            {{- '\n' + message.content }}
        {%- endif %}
        {%- for tool_call in message.tool_calls %}
            {%- if tool_call.function is defined %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {{- '\n 2Tool_Call_Start2 \n{"name": "' }}
            {{- tool_call.name }}
            {{- '", "arguments": ' }}
            {{- tool_call.arguments | tojson }}
            {{- '}\n 2Tool_Call_End2 \n' }}
            {%- if not loop.last %}
                {{- '\n' }}
            {%- endif %}
        {%- endfor %}
        {{- '<|im_end|>\n' }}
    {%- elif message.role == "tool" %}
        {%- if (loop.index0 == 0) or (messages[loop.index0 - 1].role != "tool") %}
            {{- '<|im_start|>user' }}
        {%- endif %}
        {{- '\n<tool_response>\n' }}
        {{- message.content }}
        {{- '\n</tool_response>' }}
        {%- if loop.last or (messages[loop.index0 + 1].role != "tool") %}
            {{- '<|im_end|>\n' }}
        {%- endif %}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\n' }}
{%- endif %}
 */











//old way of doing it, which probably worked, but i'm liking putting the instructions on this side, rather than a separate
//template passed to llama.cpp and maintened there.  Downside is other models will have to have a custom no-tools template.
/**
{%- if tools %}
    {{- '<|im_start|>system\n' }}
    {%- if messages[0]['role'] == 'system' %}
        {{- messages[0]['content'] }}
    {%- else %}
        {{- 'You are Qwen, created by Alibaba Cloud, with assistance from Jason. You are a helpful assistant.' }}
    {%- endif %}

    {{- "\n\n# Tools\n\n" }}
    {{- "You may use the following tools to help with user queries.\n\n" }}
    {{- "## Available Functions\n\n" }}
    {{- "<tools>\n" }}
    {%- for tool in tools %}
        {{- tool | tojson }}
        {{- "\n" }}
    {%- endfor %}
    {{- "</tools>\n\n" }}

    {{- "## Tool Call Format\n\n" }}
    {{- "When using a tool, follow this EXACT format for EACH function call:\n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"functionName\", \"arguments\": {\"param\": \"value\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- "Complete one tool call FULLY with both START and END markers before beginning another one.\n\n" }}

    {{- "## IMPORTANT: Format Requirements\n\n" }}
    {{- "1. Include BOTH underscores (_) on BOTH markers\n" }}
    {{- "2. Always include a NEWLINE after  Tool_Call_End  before starting a new  Tool_Call_Start \n" }}
    {{- "3. Check EVERY marker, especially the LAST  Tool_Call_End \n" }}
    {{- "4. Complete each tool call fully before beginning another\n\n" }}

    {{- "## IMPORTANT: Common Format Errors to Avoid\n\n" }}
    {{- "Pay close attention to the format of tool calls. The model often makes these mistakes:\n\n" }}

    {{- "### CORRECT FORMAT (Use exactly this):\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"functionName\", \"arguments\": {\"param\": \"value\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"anotherFunction\", \"arguments\": {\"param\": \"value\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}

    {{- "### COMMON INCORRECT FORMATS (Do NOT use these):\n\n" }}
    {{- "#### Missing newlines between calls:\n" }}
    {{- "❌  Tool_Call_Start \n" }}
    {{- "{\"name\": \"functionName\", \"arguments\": {\"param\": \"value\"}}\n" }}
    {{- " Tool_Call_End  Tool_Call_Start \n" }}
    {{- "{\"name\": \"anotherFunction\", \"arguments\": {\"param\": \"value\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}

    {{- "## ADDITIONAL Instructions: What the Model Should NOT Do\n\n" }}
    {{- "- **Do NOT** output an incomplete ending marker. In other words, never output `TOOL_CALL` when the complete marker should be ` Tool_Call_End `.\n\n" }}
    {{- "  **Incorrect Example:**\n" }}
    {{- "  ```\n" }}
    {{- "   Tool_Call_Start \n" }}
    {{- "  {\"name\": \"aiCreatePlan\", \"arguments\": {\"id\": \"math_operation_plan\"}}\n" }}
    {{- "  TOOL_CALL\n" }}
    {{- "  ```\n\n" }}
    {{- "  **Correct Example:**\n" }}
    {{- "  ```\n" }}
    {{- "   Tool_Call_Start \n" }}
    {{- "  {\"name\": \"aiCreatePlan\", \"arguments\": {\"id\": \"math_operation_plan\"}}\n" }}
    {{- "   Tool_Call_End \n" }}
    {{- "  ```\n\n" }}
    {{- "- Ensure that every tool call is terminated with the full ` Tool_Call_End ` marker on a new line.\n\n" }}

    {{- "## Multiple Examples of Properly Formatted Tool Calls:\n\n" }}
    {{- "### Example 1 - Math Operations (with proper newlines):\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiCreatePlan\", \"arguments\": {\"id\": \"math_operation_plan\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiAddFunctionStepToPlan\", \"arguments\": {\"id\": \"1\", \"functionName\": \"aiAdd\", \"functionArgs\": {\"a\": 5, \"b\": 5}, \"reasonToAddStep\": \"First, add 5 to 5.\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiCompletePlan\", \"arguments\": {\"completedReason\": \"Plan is complete\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}

    {{- "### Example 2 - Multiple Operations (carefully check all markers):\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiCreatePlan\", \"arguments\": {\"id\": \"complex_plan\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiAddFunctionStepToPlan\", \"arguments\": {\"id\": \"1\", \"functionName\": \"aiAdd\", \"functionArgs\": {\"a\": 10, \"b\": 5}, \"reasonToAddStep\": \"First step\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiAddFunctionStepToPlan\", \"arguments\": {\"id\": \"2\", \"functionName\": \"aiMultiply\", \"functionArgs\": {\"a\": \"$aiAdd.result\", \"b\": 2}, \"reasonToAddStep\": \"Second step\"}}\n" }}
    {{- " Tool_Call_End \n\n" }}
    {{- " Tool_Call_Start \n" }}
    {{- "{\"name\": \"aiCompletePlan\", \"arguments\": {\"completedReason\": \"Plan complete\"}}\n" }}
    {{- " Tool_Call_End \n" }}
    {{- "<|im_end|>\n" }}
{%- else %}
    {%- if messages[0]['role'] == 'system' %}
        {{- '<|im_start|>system\n' + messages[0]['content'] + '<|im_end|>\n' }}
    {%- else %}
        {{- '<|im_start|>system\nYou are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>\n' }}
    {%- endif %}
{%- endif %}
{%- for message in messages %}
    {%- if (message.role == "user") or (message.role == "system" and not loop.first) or (message.role == "assistant" and not message.tool_calls) %}
        {{- '<|im_start|>' + message.role + '\n' + message.content + '<|im_end|>' + '\n' }}
    {%- elif message.role == "assistant" %}
        {{- '<|im_start|>' + message.role }}
        {%- if message.content %}
            {{- '\n' + message.content }}
        {%- endif %}
        {%- for tool_call in message.tool_calls %}
            {%- if tool_call.function is defined %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {{- '\n Tool_Call_Start \n{"name": "' }}
            {{- tool_call.name }}
            {{- '", "arguments": ' }}
            {{- tool_call.arguments | tojson }}
            {{- '}\n Tool_Call_End \n' }}
            {%- if not loop.last %}
                {{- '\n' }}
            {%- endif %}
        {%- endfor %}
        {{- '<|im_end|>\n' }}
    {%- elif message.role == "tool" %}
        {%- if (loop.index0 == 0) or (messages[loop.index0 - 1].role != "tool") %}
            {{- '<|im_start|>user' }}
        {%- endif %}
        {{- '\n<tool_response>\n' }}
        {{- message.content }}
        {{- '\n</tool_response>' }}
        {%- if loop.last or (messages[loop.index0 + 1].role != "tool") %}
            {{- '<|im_end|>\n' }}
        {%- endif %}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\n' }}
{%- endif %}


 */
