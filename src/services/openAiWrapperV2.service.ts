import { Injectable } from '@nestjs/common';
import { ChatCompletionMessageParam, ChatCompletionMessageToolCall, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions';
import { Model } from '../models/api/conversationApiModels';
import OpenAI from 'openai';
import { AiFunctionContextV2, AiFunctionExecutor } from '../models/agent/aiTypes';
import { InvalidToolCallJsonFromLLM } from '../models/errors/errors';
interface CallOpenAiParams {
  openAiMessages: ChatCompletionMessageParam[];
  model: Model;
  totalOpenAiCallsMade?: number;
  aiFunctionContext: AiFunctionContextV2;
  handleToolCall?: HandleToolCall | undefined;
  handleToolCalls?: HandleToolCalls | undefined;
  handleMakingToolCallsAndSendingResultsToLLM?: HandleMakingToolCallsAndSendingResultsToLLM | undefined;
  // onOpenAiMessagesAdded?: OnOpenAiMessagesAdded | undefined;
}

export type CallOpenAiResponse = Promise<{ openAiMessages: ChatCompletionMessageParam[], completeText: string, totalOpenAiCallsMade: number }>;
export type HandleToolCall = (p: {toolCall: ChatCompletionMessageToolCall, aiFunctionContext: AiFunctionContextV2, openAiMessages: ChatCompletionMessageParam[]}) => Promise<ChatCompletionToolMessageParam | null>;
export type HandleToolCalls = (p: {toolCallsFromOpenAi: ChatCompletionMessageToolCall[], aiFunctionContext: AiFunctionContextV2, openAiMessages: ChatCompletionMessageParam[], handleToolCall: HandleToolCall}) => Promise<ChatCompletionMessageParam[]>;
export type HandleMakingToolCallsAndSendingResultsToLLM = (p: {toolCallsFromOpenAi: ChatCompletionMessageToolCall[], openAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContextV2, handleToolCalls: HandleToolCalls, handleToolCall: HandleToolCall}) => CallOpenAiResponse;

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
         handleToolCalls = defaultHandleToolCalls,
         handleToolCall = defaultHandleToolCall,
         handleMakingToolCallsAndSendingResultsToLLM,
       }: CallOpenAiParams): CallOpenAiResponse {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL });
    const signal = aiFunctionContext.abortController?.signal;
    const modelParams = aiFunctionContext.modelParams;

    try {
      if(model.prependNoThinkTagToBeginningOfEachMessage){
        prependNoThinkTagToBeginningOfEachMessage(openAiMessages);
      }

      totalOpenAiCallsMade += 1;
      const response = await openai.chat.completions.create({
        model: model.modelName,
        messages: openAiMessages,
        tools: aiFunctionContext.aiFunctionExecutor?.getToolsMetadata(),
        stream: false,
        temperature: modelParams?.temperature ?? 1, //Controls the randomness of responses. Lower values (e.g., 0.2) produce more deterministic and focused outputs, while higher values (e.g., 0.8) make responses more creative and varied
        top_p: modelParams?.top_p ?? 1, //Controls diversity by considering only the top P percent of probable words. Lower values make responses more predictable, while higher values allow for more variety
        frequency_penalty: modelParams?.frequency_penalty ?? 0, //Penalizes repeated tokens based on frequency in the generated text. Higher values discourage repetition
        presence_penalty: modelParams?.presence_penalty ?? 0, //Encourages introducing new topics by penalizing tokens already present in the context
      }, { signal });

      const assistantMessage = response.choices[0].message;
      //handle weird edge case with content and tool calls both being returned by some models.
      const parsedToolCalls = parseToolCallsDueToOccasionalIssueOfLlamaCppNotRespondingWithJson(assistantMessage.content);
      if(parsedToolCalls){
        assistantMessage.content = null;
        assistantMessage.tool_calls = parsedToolCalls;
      }

      // Add the assistant's message to our conversation
      const newOpenAiMessage: ChatCompletionMessageParam = {
        role: 'assistant' as const,
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls
      };
      openAiMessages.push(newOpenAiMessage);
      await aiFunctionContext.onOpenAiMessagesAdded?.({openAiMessages: [newOpenAiMessage]}); //for letting the db know.

      const toolCallsFromOpenAi = assistantMessage.tool_calls;

      if(toolCallsFromOpenAi){
        const defaultHandleMakingToolCallsAndSendingResultsToLLM: HandleMakingToolCallsAndSendingResultsToLLM = async ({toolCallsFromOpenAi, aiFunctionContext, handleToolCalls, openAiMessages, handleToolCall}) => {
          const toolCallResultsOpenAiMessages = await handleToolCalls({toolCallsFromOpenAi, aiFunctionContext, openAiMessages, handleToolCall});
          openAiMessages.push(...toolCallResultsOpenAiMessages);
          await aiFunctionContext.onOpenAiMessagesAdded?.({openAiMessages: toolCallResultsOpenAiMessages});
          // Make a recursive call to continue the conversation and return its result
          return this.callOpenAiUsingModelAndSubject({ openAiMessages, model, totalOpenAiCallsMade, aiFunctionContext, });
        };
        const handleMakingToolCallsFunc = handleMakingToolCallsAndSendingResultsToLLM ?? defaultHandleMakingToolCallsAndSendingResultsToLLM;
        return handleMakingToolCallsFunc({toolCallsFromOpenAi, aiFunctionContext, handleToolCalls, openAiMessages, handleToolCall});
      }else {
        const completeText = response.choices[0].message.content ?? '';
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
  async callOpenAiUsingModelAndSubjectStream({ openAiMessages, model, totalOpenAiCallsMade = 0, aiFunctionContext, }: CallOpenAiParams, allowToolCalls = false)
    : Promise<{ openAiMessages: ChatCompletionMessageParam[], completeText: string, totalOpenAiCallsMade: number }> {
    const apiKey = model.apiKey;
    const baseURL = model.url;
    const openai = new OpenAI({ apiKey, baseURL });
    const signal = aiFunctionContext.abortController?.signal;
    const modelParams = aiFunctionContext.modelParams;
    let completeText = '';
    let assistantMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content: '',
      tool_calls: []
    };

    try {
      totalOpenAiCallsMade += 1;

      if(model.prependNoThinkTagToBeginningOfEachMessage){
        prependNoThinkTagToBeginningOfEachMessage(openAiMessages);
      }
      const stream = await openai.chat.completions.create({
        model: model.modelName,
        messages: openAiMessages,
        tools: allowToolCalls ? aiFunctionContext.aiFunctionExecutor?.getToolsMetadata() : undefined,
        stream: true,
        temperature: modelParams?.temperature ?? 1, //Controls the randomness of responses. Lower values (e.g., 0.2) produce more deterministic and focused outputs, while higher values (e.g., 0.8) make responses more creative and varied
        top_p: modelParams?.top_p ?? 1, //Controls diversity by considering only the top P percent of probable words. Lower values make responses more predictable, while higher values allow for more variety
        frequency_penalty: modelParams?.frequency_penalty ?? 0, //Penalizes repeated tokens based on frequency in the generated text. Higher values discourage repetition
        presence_penalty: modelParams?.presence_penalty ?? 0, //Encourages introducing new topics by penalizing tokens already present in the context
      }, { signal });

      for await (const chunk of stream) {
        if(!chunk.choices || chunk.choices.length <= 0){
          continue;
        }
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
      await aiFunctionContext.onOpenAiMessagesAdded?.({openAiMessages: [assistantMessage]}); //for letting the db know.

      const toolCallsFromOpenAi = assistantMessage.tool_calls;
      if(toolCallsFromOpenAi && toolCallsFromOpenAi.length > 0){
        const newOpenAiMessages = await defaultHandleToolCalls({toolCallsFromOpenAi, aiFunctionContext, openAiMessages, handleToolCall: defaultHandleToolCall});
        openAiMessages.push(...newOpenAiMessages);
        await aiFunctionContext.onOpenAiMessagesAdded?.({openAiMessages: newOpenAiMessages}); //for letting the db know.
        // Make a recursive call to continue the conversation and return its result
        return this.callOpenAiUsingModelAndSubject({ openAiMessages, model, totalOpenAiCallsMade, aiFunctionContext, });
      }else {
        // aiFunctionContext.inferenceSSESubject?.sendComplete();
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

export const defaultHandleToolCalls: HandleToolCalls = async ({ toolCallsFromOpenAi, aiFunctionContext, openAiMessages, handleToolCall }) => {
  const toolResultMessages: ChatCompletionMessageParam[] = [];
  for (const toolCall of toolCallsFromOpenAi) {
    try {
      const toolResponse = await handleToolCall({toolCall, aiFunctionContext, openAiMessages});
      if (toolResponse) {
        //@ts-ignore i forget why we want this...
        toolResponse.name = toolCall.function.name;
        toolResultMessages.push(toolResponse);
      }
    } catch (error) {
      console.error(`Error processing tool call: ${error}`);
      throw error;
    }
  }
  return toolResultMessages;
}

// async function defaultHandleToolCall(toolCall: ChatCompletionMessageToolCall, aiFunctionContext: AiFunctionContextV2): Promise<{ tool_response: { name: string; content: any } } | null> {
export const defaultHandleToolCall: HandleToolCall = async ({toolCall, aiFunctionContext}) => {
  const {inferenceSSESubject: subject, aiFunctionExecutor: toolService} = aiFunctionContext;
  if(!toolService){
    throw new Error('no toolsService/aiFunctionExecutor');
  }
  try {
    const { toolName, toolArgs } = parseToolNameAndArgumentsFromToolCall(toolCall);
    if (typeof toolService[toolName] == 'function') {
      const result = await toolService[toolName](toolArgs, aiFunctionContext);
      return {
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.result),
        role: 'tool',
      };
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


function parseToolCallsDueToOccasionalIssueOfLlamaCppNotRespondingWithJson(assistantContentResponse: string | null): ChatCompletionMessageToolCall[] | undefined {
  return undefined;//this breaks sometimes when we get valid tool calls but also content like <tool_call>\n{}\n{}\n{}</tool_call>
  // if(!assistantContentResponse){ return undefined; }
  // // const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs; // doesn't match when there are new lines.
  // const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g; // Matches everything inside <tool_call>...</tool_call>, including newlines
  // const toolCalls: ChatCompletionMessageToolCall[] = [];
  //
  // // Find all tool_calls within the response content
  // const matches = assistantContentResponse.match(toolCallRegex);
  //
  // if (matches) {
  //   // For each match, extract the JSON and parse it
  //   matches.forEach((match) => {
  //     const jsonStr = match.replace(/<tool_call>|<\/tool_call>/g, ''); // remove the <tool_call> tags
  //     try {
  //       const parsedJson =  JSON.parse(jsonStr); // parse the JSON string
  //       toolCalls.push(parsedJson); // add to the tool_calls array
  //     } catch (e) {
  //       console.error('Error parsing tool_call JSON:', e);
  //       throw new InvalidToolCallJsonFromLLM(e.message); //TODO: retry.
  //     }
  //   });
  // }
  // return toolCalls.length > 0 ? toolCalls : undefined;
}


function prependNoThinkTagToBeginningOfEachMessage(openAiMessages: ChatCompletionMessageParam[]){
  for(let m of openAiMessages){
    if(m.role === 'user' && m.content){
      m.content = `/no_think ${m.content}`;
    }
  }
}