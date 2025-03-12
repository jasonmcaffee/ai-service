import { Model } from '../api/conversationApiModels';
import { PlanExecutor } from './PlanExecutor';
import { AiFunctionContextV2, AiFunctionExecutor } from './aiTypes';
import InferenceSSESubject from '../InferenceSSESubject';
import { ChatCompletionMessageParam, ChatCompletionMessageToolCall, } from 'openai/resources/chat/completions';
import PlannerAgentV2 from './PlannerAgentV2';
import { OpenaiWrapperServiceV2 } from '../../services/openAiWrapperV2.service';
import { ChatCompletionToolMessageParam } from 'openai/resources/chat/completions';
import { AiFunctionStep } from './AgentPlan';
import { uuid } from '../../utils/utils';

/**
 * Planner Executor Architecture is a two phase approach to responding to a prompt when using tools/functions the AI can call.
 * Planner
 * - creates a plan with a series of functions to call.
 * -- e.g. "What is 5 + 5, then subtract 7?" would result in a plan of aiFunctionSteps [{name: "aiAdd", arguments: {a: 5, b: 5}}, {name: "aiSubtract", arguments: {a: "$aiAdd.result", b: 7}}]
 * Executor
 * - iterates over each function step, subbing out variable references with actual values. e.g. param value "$aiAdd.result" gets replaced with 5.
 * - passes each function a context, and stores the results.
 * Agent
 * - after executing, convert the aiFunctionSteps into 'Assistant' tool calls, and tool call result messages.
 * -- essentially we're modifying the messages/state in such a way as the LLM is not aware of Planner Related messages, but is aware of all the tool call and tool call results.
 * - send the new state of messages to the LLM, and have it stream the response back.
 */
export class PlanAndExecuteAgent<TAiFunctionExecutor>{
  constructor(private readonly model: Model,
              private readonly openAiWrapperServiceV2: OpenaiWrapperServiceV2,
              private readonly memberId: string,
              private readonly aiFunctionExecutor: AiFunctionExecutor<TAiFunctionExecutor> | undefined,
              private readonly inferenceSSESubject: InferenceSSESubject,  //needed so we can tell the llm about the results of executing the plan.
              private readonly abortController: AbortController,
  ) {}

  /**
   * This allows us to have one AI create a plan with a series of functions to call, then have another AI execute the functions.
   * e.g. we might have a complicated workflow that needs a big AI model to reason about, but then we might want to save money by using a smaller AI model perform the work.
   * Uses a PlannerAgent to first have AI provide all the functions it would call, and arguments it would pass, in order to fulfill the user's request/prompt.
   * Then executes the functions, as if the AI had called tool_calls for each function, and passes the tool call results to the AI, then streams the response.
   *
   * @param prompt
   * @param originalOpenAiMessages
   */
  async planAndExecuteThenStreamResultsBack(prompt: string, originalOpenAiMessages: ChatCompletionMessageParam[], addUserPromptToMessagesBeforeSending: boolean){
    if(!this.aiFunctionExecutor){
        const r2 = await this.callLlmWithoutUsingPlanOrTools(prompt, originalOpenAiMessages, addUserPromptToMessagesBeforeSending);
        return {planFinalResult: undefined, finalResponseFromLLM: r2.completeText, plannerAgent: undefined, planExecutor: undefined};
    }
    const topicId = uuid();
    try{
      this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `Asking planning agent to create a plan to use tools based on user's request.`, });
      //planner agent's result will be the original messages + the tool call results.
      const plannerAgent = new PlannerAgentV2(this.model, this.openAiWrapperServiceV2, this.memberId, this.aiFunctionExecutor, this.inferenceSSESubject, originalOpenAiMessages);
      const { openAiMessages: originalAiMessagesPlusPlannerAgentMessagesAndResults, completeText, totalOpenAiCallsMade, agentPlan } = await plannerAgent.askAiToCreateAnAgentPlan(prompt);


      const aiFunctionContext: AiFunctionContextV2 = {
        functionResultsStorage: {},
        aiFunctionExecutor: this.aiFunctionExecutor,
        abortController: this.abortController,
        inferenceSSESubject: this.inferenceSSESubject,
        memberId: this.memberId,
      };
      const planExecutor = new PlanExecutor(agentPlan, aiFunctionContext);
      if(!plannerAgent.agentPlan){
        this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `Error encountered creating plan: no was created.`, isError: true, topicCompleted: true});
        console.error(`agentPlan is missing!`, plannerAgent);
        throw new Error('agentPlan is missing'); //todo: sometimes the closing tag isn't supplied.  We should add retry plan N times.
      }

      let planFinalResult; //can be error
      try{
        this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `Executing plan.`, });
        await planExecutor.executePlan();
        planFinalResult = await planExecutor.getFinalResultFromPlan();
      }catch(e){
        this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `Error encountered executing plan: ${e.message}`, isError: true});
        planFinalResult = e;
      }
      //note: send the original openAi messages, not the one for executing the plan again.
      this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `Sending executed plan results to AI.`, });
      const r2 = await this.convertAiFunctionStepsToToolsAndSendToLLM(prompt, plannerAgent, planFinalResult, originalOpenAiMessages, aiFunctionContext, addUserPromptToMessagesBeforeSending);
      this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `AI completed handling executed plan results.`, topicCompleted: true});
      return {planFinalResult, finalResponseFromLLM: r2.completeText, plannerAgent, planExecutor};
    }catch(e){
      console.error(`PlanAndExecuteAgent error: `, e);
      this.inferenceSSESubject?.sendStatus({topicId, topic: 'planningAndExecuting', displayText: `Error encountered sending results to AI: ${e.message}`, isError: true, topicCompleted: true});
      throw e;
    }
  }

  async callLlmWithoutUsingPlanOrTools(prompt: string, originalOpenAiMessages: ChatCompletionMessageParam[], addUserPromptToMessagesBeforeSending: boolean){
    const newOpenAiMessages: ChatCompletionMessageParam[] = addUserPromptToMessagesBeforeSending ? [
      {role: 'user', content: prompt},
      ...originalOpenAiMessages
    ] : originalOpenAiMessages;

    const aiFunctionContext: AiFunctionContextV2 = {
      functionResultsStorage: {},
      aiFunctionExecutor: this.aiFunctionExecutor,
      abortController: this.abortController,
      inferenceSSESubject: this.inferenceSSESubject,
      memberId: this.memberId,
    };

    return this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubjectStream({
      openAiMessages: newOpenAiMessages,
      aiFunctionContext,
      model: this.model,
    });
  }
  async convertAiFunctionStepsToToolsAndSendToLLM(userPrompt: string, plannerAgent: PlannerAgentV2,
                                                  planFinalResult: any, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContextV2, addUserPromptToMessagesBeforeSending: boolean){
    const userMessage: ChatCompletionMessageParam = {role: 'user', content: userPrompt};

    const assistantMessageWithToolCallsAndToolCallResultMessages = convertAiFunctionStepsToAssistantMessageWithToolCallsAndToolResultMessages(plannerAgent);

    const newOpenAiMessages: ChatCompletionMessageParam[] = [...originalOpenAiMessages,];
    if(addUserPromptToMessagesBeforeSending){
      newOpenAiMessages.push(userMessage);
    }
    newOpenAiMessages.push(...assistantMessageWithToolCallsAndToolCallResultMessages);

    return this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubjectStream({
      openAiMessages: newOpenAiMessages,
      totalOpenAiCallsMade: 0,
      model: this.model,
      aiFunctionContext,
    });
  }
}

/**
 * return openai messages which make it look like the LLM called tools via the assistant message, and got back tool results via tool messages.
 * e.g.
 * [
 *   {
 *    role: 'assistant',
 *    tool_calls: [
 *      {
 *        type: 'function',
 *        function: {
 *          name: 'aiAdd',
 *          arguments: { a: 4, b: 5}
 *        }
 *      }
 *    ]
 *   },
 *   {
 *     role: 'tool',
 *     content: '9'
 *   }
 * ]
 * @param plannerAgent
 */
function convertAiFunctionStepsToAssistantMessageWithToolCallsAndToolResultMessages(plannerAgent: PlannerAgentV2): ChatCompletionMessageParam[]{
  const toolCalls: ChatCompletionMessageToolCall[] = [];
  const toolCallMessageResults: ChatCompletionToolMessageParam[] = [];
  for(let aiFunctionStep of plannerAgent.agentPlan.functionSteps){
    const {toolCall, toolCallResultMessage} = convertAiFunctionStepToOpenAiToolCallMessageAndToolCallResultMessage(aiFunctionStep);
    toolCalls.push(toolCall);
    toolCallMessageResults.push(toolCallResultMessage);
  }

  //make it so it seems like the LLM made a tool call for every function step, using the appropriate parameters.
  const assistantMessage: ChatCompletionMessageParam = {
    role: 'assistant',
    content: '',
    tool_calls: toolCalls,
  };

  return [
    assistantMessage,
    ...toolCallMessageResults,
  ];
}

function convertAiFunctionStepToOpenAiToolCallMessageAndToolCallResultMessage(aiFunctionStep: AiFunctionStep)
  : {toolCall: ChatCompletionMessageToolCall, toolCallResultMessage: ChatCompletionToolMessageParam}{
  const functionStepResult = aiFunctionStep.result;

  const toolCall: ChatCompletionMessageToolCall = {
    id: aiFunctionStep.id,
    type: "function",
    function: {
      name: aiFunctionStep.functionName,
      // arguments: JSON.stringify(aiFunctionStep.functionArgumentsUsedDuringExecution), <-- don't pass this as there might be a getSearchResults, then summarize("all the search") bloat.
      arguments: JSON.stringify(aiFunctionStep.functionArgumentsPassedByLLM),
    }
  };
  //Errors don't serialize to JSON, so we need special handling.
  const toolResultContent = functionStepResult instanceof Error ?
    JSON.stringify({
      error: {
        description: `an error occurred while executing the ${aiFunctionStep.functionName}.`,
        details: {
          name: functionStepResult.name,
          message: functionStepResult.message
        }
      }
    }) :
    JSON.stringify(functionStepResult);

  const toolCallResultMessage: ChatCompletionToolMessageParam = {
    role: 'tool',
    tool_call_id: aiFunctionStep.id,
    //@ts-ignore just send the extra data
    name: aiFunctionStep.functionName, //TODO probably don't do this.
    content: toolResultContent,
  };

  return { toolCall, toolCallResultMessage};
}
//
//
// async convertAiFunctionStepsToToolsAndSendToLLM(userPrompt: string, plannerAgent: PlannerAgentV2, planFinalResult: any, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContextV2){
//   const userMessage: ChatCompletionMessageParam = {role: 'user', content: userPrompt};
//
//   const toolName = "workRelatedToUserPrompt";
//   const toolId = uuidv4();
//   const toolCall1: ChatCompletionMessageToolCall = {
//     id: toolId,
//     type: "function",
//     function: {
//       name: toolName,
//       arguments: JSON.stringify({userPrompt}),
//     }
//   };
//
//   const assistantMessage: ChatCompletionMessageParam = {
//     role: 'assistant',
//     content: '',
//     tool_calls: [toolCall1]
//   };
//
//   const toolResultContent = planFinalResult instanceof Error ?
//     JSON.stringify({
//       error: {
//         description: `an error occurred while executing the ${toolName}.`,
//         details: { name: planFinalResult.name, message: planFinalResult.message}
//       }
//     }) :
//     JSON.stringify(planFinalResult);
//
//   const toolResultMessage: ChatCompletionToolMessageParam = {
//     role: 'tool',
//     tool_call_id: toolId,
//     //@ts-ignore just send the extra data
//     name: toolName,
//     content: toolResultContent,
//   };
//
//   const newOpenAiMessages: ChatCompletionMessageParam[] = [
//     ...originalOpenAiMessages,
//     userMessage,
//     assistantMessage,
//     toolResultMessage,
//   ];
//
//   return this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubjectStream({
//     openAiMessages: newOpenAiMessages,
//     totalOpenAiCallsMade: 0,
//     model: this.model,
//     aiFunctionContext,
//   });
// }
