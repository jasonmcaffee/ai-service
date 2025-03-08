import { Model } from '../api/conversationApiModels';
import { PlanExecutor } from './PlanExecutor';
import { AiFunctionContextV2, AiFunctionExecutor } from './aiTypes';
import InferenceSSESubject from '../InferenceSSESubject';
import {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import PlannerAgentV2 from './PlannerAgentV2';
import { OpenaiWrapperServiceV2 } from '../../services/openAiWrapperV2.service';
import { ChatCompletionToolMessageParam } from 'openai/src/resources/chat/completions';

const { v4: uuidv4 } = require('uuid');
/**
 * Primarily responsible for:
 * - creating a plan based on user prompt and available tools.
 * - executing the plan to get the final result
 * - telling the llm about the result.
 */
export class PlanAndExecuteAgent<TAiFunctionExecutor>{
  constructor(private readonly model: Model, private readonly openAiWrapperServiceV2: OpenaiWrapperServiceV2,
              private readonly memberId: string,
              private readonly aiFunctionExecutor: AiFunctionExecutor<TAiFunctionExecutor>,
              private readonly inferenceSSESubject: InferenceSSESubject,  //needed so we can tell the llm about the results of executing the plan.
              private readonly abortController: AbortController,
  ) {
  }

  async createAndExecutePlanUsingTools<TAiFunctionExecutor>(prompt: string, originalOpenAiMessages: ChatCompletionMessageParam[]){
    try{
      //planner agent's result will be the original messages + the tool call results.
      const plannerAgent = new PlannerAgentV2(this.model, this.openAiWrapperServiceV2, this.memberId, this.aiFunctionExecutor, this.inferenceSSESubject, originalOpenAiMessages);
      const { openAiMessages: originalAiMessagesPlusPlannerAgentMessagesAndResults, completeText, totalOpenAiCallsMade, agentPlan } = await plannerAgent.askAiToCreateAnAgentPlan(prompt);
      const aiFunctionContext: AiFunctionContextV2 = {
        functionResults: {},
        aiFunctionExecutor: this.aiFunctionExecutor,
        abortController: this.abortController,
        inferenceSSESubject: this.inferenceSSESubject,
        memberId: this.memberId,
      };
      const planExecutor = new PlanExecutor(agentPlan, aiFunctionContext);
      if(!plannerAgent.agentPlan){
        console.error(`agentPlan is missing!`, plannerAgent);
        throw new Error('agentPlan is missing'); //todo: sometimes the closing tag isn't supplied.  We should add retry plan N times.
      }

      let planFinalResult; //can be error
      try{
        await planExecutor.executePlanIgnoringHallucinatedFunctions();
        planFinalResult = await planExecutor.getFinalResultFromPlan();
      }catch(e){
        planFinalResult = e;
      }
      //note: send the original openAi messages, not the one for executing the plan again.
      const r2 = await this.convertAiFunctionStepsToToolsAndSendToLLM(prompt, plannerAgent, planFinalResult, originalOpenAiMessages, aiFunctionContext);
      return {planFinalResult, finalResponseFromLLM: r2.completeText, plannerAgent, planExecutor};
    }catch(e){
      console.error(`PlanAndExecuteAgent error: `, e);
      throw e;
    }
  }

  async convertAiFunctionStepsToToolsAndSendToLLM(userPrompt: string, plannerAgent: PlannerAgentV2, planFinalResult: any, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContextV2){
    const userMessage: ChatCompletionMessageParam = {role: 'user', content: userPrompt};

    const toolName = "workRelatedToUserPrompt";
    const toolId = uuidv4();
    const toolCall1: ChatCompletionMessageToolCall = {
      id: toolId,
      type: "function",
      function: {
        name: toolName,
        arguments: JSON.stringify({userPrompt}),
      }
    };

    const assistantMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content: '',
      tool_calls: [toolCall1]
    };

    const toolResultContent = planFinalResult instanceof Error ?
      JSON.stringify({
        error: {
          description: `an error occurred while executing the ${toolName}.`,
          details: { name: planFinalResult.name, message: planFinalResult.message}
        }
      }) :
      JSON.stringify(planFinalResult);

    const toolResultMessage: ChatCompletionToolMessageParam = {
      role: 'tool',
      tool_call_id: toolId,
      //@ts-ignore just send the extra data
      name: toolName,
      content: toolResultContent,
    };


    // const newPrompt = getPromptToTellLLMAboutTheUserPromptAndPlanAndResult(userPrompt, plannerAgent, planFinalResult);
    const newOpenAiMessages: ChatCompletionMessageParam[] = [
      ...originalOpenAiMessages,
      userMessage,
      assistantMessage,
      toolResultMessage,
    ];

    // this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubject(originalOpenAiMessages, this.model, this.memberId, this.inferenceSSESubject, this.abortController, this.aiFunctionExecutor, this.aiFunctionExecutor.getToolsMetadata, 0, context);
    return this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubjectStream({
      openAiMessages: newOpenAiMessages,
      totalOpenAiCallsMade: 0,
      model: this.model,
      aiFunctionContext,
    });
  }
}
