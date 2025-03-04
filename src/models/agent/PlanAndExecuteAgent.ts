import PlannerAgent from './PlannerAgent';
import { Model } from '../api/conversationApiModels';
import { OpenaiWrapperService } from '../../services/openaiWrapper.service';
import { PlanExecutor } from './PlanExecutor';
import { AiFunctionContext, AiFunctionExecutor } from './aiTypes';
import InferenceSSESubject from '../InferenceSSESubject';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Primarily responsible for:
 * - creating a plan based on user prompt and available tools.
 * - executing the plan to get the final result
 * - telling the llm about the result.
 */
export class PlanAndExecuteAgent<TAiFunctionExecutor>{
  constructor(private readonly model: Model, private readonly openAiWrapperService: OpenaiWrapperService,
              private readonly memberId: string,
              private readonly aiFunctionExecutor: AiFunctionExecutor<TAiFunctionExecutor>,
              private readonly inferenceSSESubject: InferenceSSESubject,  //needed so we can tell the llm about the results of executing the plan.
              private readonly abortController: AbortController,
  ) {
  }

  async createAndExecutePlanUsingTools<TAiFunctionExecutor>(prompt: string, originalOpenAiMessages: ChatCompletionMessageParam[]){
    try{
      const plannerAgent = new PlannerAgent(this.model, this.openAiWrapperService, this.memberId, this.aiFunctionExecutor, this.inferenceSSESubject, originalOpenAiMessages);
      const { openAiMessages, completeText, totalOpenAiCallsMade, agentPlan } = await plannerAgent.createPlan(prompt);
      const aiFunctionContext: AiFunctionContext = {functionResults: {}, aiFunctionExecutor: this.aiFunctionExecutor};
      const planExecutor = new PlanExecutor(agentPlan, aiFunctionContext);
      if(!plannerAgent.agentPlan){
        console.error(`agentPlan is missing!`, plannerAgent);
        throw new Error('agentPlan is missing'); //todo: sometimes the closing tag isn't supplied.  We should add retry plan N times.
      }
      await planExecutor.executePlan();
      const planFinalResult = await planExecutor.getFinalResultFromPlan();
      //note: send the original openAi messages, not the one for executing the plan again.
      const r2 = await this.sendPlanFinalResultToLLM(plannerAgent, planFinalResult, originalOpenAiMessages, aiFunctionContext);
      return {planFinalResult};
    }catch(e){
      console.error(`PlanAndExecuteAgent error: `, e);
      throw e;
    }
  }

  async sendPlanFinalResultToLLM(plannerAgent: PlannerAgent, planFinalResult: any, openAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContext){
    const newPrompt = getPromptToTellLLMAboutTheUserPromptAndPlanAndResult(plannerAgent, planFinalResult);
    const newOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'user', content: newPrompt},
      ...openAiMessages,
    ];

    // this.openAiWrapperService.callOpenAiUsingModelAndSubject(openAiMessages, this.model, this.memberId, this.inferenceSSESubject, this.abortController, this.aiFunctionExecutor, this.aiFunctionExecutor.getToolsMetadata, 0, context);
    return this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages: newOpenAiMessages,
      toolService: this.aiFunctionExecutor,
      tools: this.aiFunctionExecutor.getToolsMetadata(),
      totalOpenAiCallsMade: 0,
      memberId: this.memberId,
      model: this.model,
      inferenceSSESubject: this.inferenceSSESubject,
      abortController: this.abortController,
      aiFunctionContext,
    });
  }

}


function getPromptToTellLLMAboutTheUserPromptAndPlanAndResult(
  plannerAgent: PlannerAgent,
  planFinalResult: any
): string {
  // Convert final result to a string for consistent handling
  const planFinalResultAsString = typeof planFinalResult === "string"
    ? planFinalResult
    : JSON.stringify(planFinalResult, null, 2);

  // Generate XML-formatted function steps
  const functionStepsTakenAsString = plannerAgent.agentPlan.functionSteps
    .map(functionStep => `
      <function_step>
        <name>${functionStep.functionName}</name>
        <reason>${functionStep.reasonToAddStep}</reason>
      </function_step>
    `).join('\n');

  return `
    # Response Generation Instructions

    ## Context
    The previous user message initiated a multi-step planning process that resulted in a specific outcome. 

    ## Response Requirements
    1. Summarize the original user request
    2. Detail ALL function steps executed:
       - Function name
       - Reason for calling the function
    3. Explain the final result clearly
    4. Maintain a professional and informative tone

    ## Function Steps Executed
    <function_steps>
      ${functionStepsTakenAsString}
    </function_steps>

    ## Final Result
    <final_result>
      ${planFinalResultAsString}
    </final_result>

    ## Response Guidelines
    - Be precise and concise
    - Use clear, accessible language
    - Directly address the original request

    ## Good Response Example:
    Based on your request to [describe original request], I utilized these strategic steps:
    - Function A: Reason for calling
    - Function B: Reason for calling

    The result reveals: [clear, concise summary of findings]

    ## Avoid These Response Patterns:
    ❌ Vague explanations
    ❌ Overly technical language
    ❌ Responses that don't address the original request

    ## Final Instruction
    Provide a response that clearly demonstrates the process and insights gained.
  `;
}
