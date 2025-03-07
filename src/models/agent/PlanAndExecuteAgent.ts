import PlannerAgent from './PlannerAgent';
import { Model } from '../api/conversationApiModels';
import { OpenaiWrapperService } from '../../services/openaiWrapper.service';
import { PlanExecutor } from './PlanExecutor';
import { AiFunctionContext, AiFunctionContextV2, AiFunctionExecutor } from './aiTypes';
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
      try{
        await planExecutor.executePlan();
      }catch(e){
        const r2 = await this.handleToolError(e, prompt, plannerAgent, originalAiMessagesPlusPlannerAgentMessagesAndResults, aiFunctionContext);
        return {planFinalResult: undefined, finalResponseFromLLM: r2.completeText, plannerAgent, planExecutor};
      }

      const planFinalResult = await planExecutor.getFinalResultFromPlan();
      //note: send the original openAi messages, not the one for executing the plan again.
      const r2 = await this.sendPlanFinalResultToLLM(prompt, plannerAgent, planFinalResult, originalOpenAiMessages, aiFunctionContext);
      return {planFinalResult, finalResponseFromLLM: r2.completeText, plannerAgent, planExecutor};
    }catch(e){
      console.error(`PlanAndExecuteAgent error: `, e);
      throw e;
    }
  }

  async handleToolError(error: any, userPrompt: string, plannerAgent: PlannerAgentV2, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContextV2,){
    const newPrompt = getPromptToTellLlmItMadeAnErrorWhenTryingToCallTools(error, userPrompt, plannerAgent, aiFunctionContext.aiFunctionExecutor?.getToolsMetadata());
    const newOpenAiMessages: ChatCompletionMessageParam[] = [
      ...originalOpenAiMessages,
      {role: 'user', content: newPrompt},
    ];

    // this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubject(originalOpenAiMessages, this.model, this.memberId, this.inferenceSSESubject, this.abortController, this.aiFunctionExecutor, this.aiFunctionExecutor.getToolsMetadata, 0, context);
    return this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubject({
      openAiMessages: newOpenAiMessages,
      totalOpenAiCallsMade: 0,
      model: this.model,
      aiFunctionContext,
    });
  }

  async sendPlanFinalResultToLLM(userPrompt: string, plannerAgent: PlannerAgentV2, planFinalResult: any, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContextV2){
    const userMessage: ChatCompletionMessageParam = {role: 'user', content: userPrompt};

    const toolId = uuidv4();
    const toolCall1: ChatCompletionMessageToolCall = {
      id: toolId,
      type: "function",
      function: {
        name: "workRelatedToUserPrompt",
        arguments: JSON.stringify({userPrompt}),
      }
    };

    const assistantMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content: '',
      tool_calls: [toolCall1]
    };

    const toolResultMessage: ChatCompletionToolMessageParam = {
      role: 'tool',
      tool_call_id: toolId,
      //@ts-ignore just send the extra data
      name: toolCall1.function.name,
      content: JSON.stringify(planFinalResult)
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


function getPromptToTellLLMAboutTheUserPromptAndPlanAndResult(
  userPrompt: string,
  plannerAgent: PlannerAgentV2,
  planFinalResult: any
): string {
  // Convert final result to a string for consistent handling
  const planFinalResultAsString = typeof planFinalResult === "string"
    ? planFinalResult
    : JSON.stringify(planFinalResult, null, 2);

  return `
    # Instructions
    The user had a request, for which aiCreatePlan was called, with a series of function steps to run.
    You are an expert at evaluating the results of the function steps in the plan.
    
    The results from running the steps in the plan can be found below in the <final_result> tag.
    <final_result>
      ${planFinalResultAsString}
    </final_result>
    
    Answer the user's request using the information found in the final_result.
  `;
}

function getPromptToTellLlmItMadeAnErrorWhenTryingToCallTools(error: any, userPrompt: string, plannerAgent: PlannerAgentV2, tools?: ChatCompletionTool[]){
  let toolFunctionNames = tools?.map(t => t.function.name).join(', ');
  const functionNamesAttempted = plannerAgent.agentPlan.functionSteps.map(fs => fs.functionName).join(', ');
  return `
    Agent, you recently tried to call a tool that resulted in an error.  e.g. you probably referenced a tool that was not in the <tools> xml tag.
    You attempted to call these function names: [${functionNamesAttempted}]
    
    But the tools only defined these function names: [${toolFunctionNames}]
    
    And that resulted in error: ${JSON.stringify(error)}
    
    Respond to the user with the above info, and explain why you made that error, and then do your best to respond to the user's request, without using tools.
    Give a detailed analysis of why you made the error, and include well thought out potential changes to the requests/prompts/questions given to you that could help improve your accuracy. e.g. perhaps the tool format is not easy to understand and can be improved, perhaps your training data has hard coded tools, etc.
    The user's original prompt can be found in the prompt tag below:
    <prompt>${userPrompt}</prompt>
  `;
}
