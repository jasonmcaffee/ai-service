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
      const r2 = await this.sendPlanFinalResultToLLM(prompt, plannerAgent, planFinalResult, originalOpenAiMessages, aiFunctionContext);
      return {planFinalResult, finalResponseFromLLM: r2.completeText};
    }catch(e){
      console.error(`PlanAndExecuteAgent error: `, e);
      throw e;
    }
  }

  async sendPlanFinalResultToLLM(userPrompt: string, plannerAgent: PlannerAgent, planFinalResult: any, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContext){
    const newPrompt = getPromptToTellLLMAboutTheUserPromptAndPlanAndResult(userPrompt, plannerAgent, planFinalResult);
    const newOpenAiMessages: ChatCompletionMessageParam[] = [
      ...originalOpenAiMessages,
      {role: 'system', content: newPrompt},
    ];

    // this.openAiWrapperService.callOpenAiUsingModelAndSubject(originalOpenAiMessages, this.model, this.memberId, this.inferenceSSESubject, this.abortController, this.aiFunctionExecutor, this.aiFunctionExecutor.getToolsMetadata, 0, context);
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
  userPrompt: string,
  plannerAgent: PlannerAgent,
  planFinalResult: any
): string {
  // Convert final result to a string for consistent handling
  const planFinalResultAsString = typeof planFinalResult === "string"
    ? planFinalResult
    : JSON.stringify(planFinalResult, null, 2);

  // Generate XML-formatted function steps
  // const functionStepsTakenAsString = plannerAgent.agentPlan.functionSteps
  //   .map(functionStep => `
  //     <function_step>
  //       <name>${functionStep.functionName}</name>
  //       <reason>${functionStep.reasonToAddStep}</reason>
  //     </function_step>
  //   `).join('\n');

  return `
    <user_request>${userPrompt}</user_request>
    
    An ai agent has intercepted the above user_reqest and responded with the final_result below:
    <final_result>
      ${planFinalResultAsString}
    </final_result>
    
    Respond to the user_request using the information in the final_result tag.
  `;
}
