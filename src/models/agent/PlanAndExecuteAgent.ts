import PlannerAgent from './PlannerAgent';
import { Model } from '../api/conversationApiModels';
import { OpenaiWrapperService } from '../../services/openaiWrapper.service';
import { PlanExecutor } from './PlanExecutor';
import { AiFunctionContext, AiFunctionExecutor } from './aiTypes';
import InferenceSSESubject from '../InferenceSSESubject';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

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
      try{
        await planExecutor.executePlan();
      }catch(e){
        const r2 = await this.handleToolError(e, prompt, plannerAgent, originalOpenAiMessages, aiFunctionContext);
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

  async handleToolError(error: any, userPrompt: string, plannerAgent: PlannerAgent, originalOpenAiMessages: ChatCompletionMessageParam[], aiFunctionContext: AiFunctionContext,){
    const newPrompt = getPromptToTellLlmItMadeAnErrorWhenTryingToCallTools(error, userPrompt, plannerAgent, aiFunctionContext.aiFunctionExecutor.getToolsMetadata());
    const newOpenAiMessages: ChatCompletionMessageParam[] = [
      ...originalOpenAiMessages,
      {role: 'user', content: newPrompt},
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

  return `
    # Instructions
    For this request your job is to simply print out exactly what is inside of the <final_result> tag.
    Respond with the exact text inside the final_result.  Do not add any other text.
    
    <user_request>${userPrompt}</user_request>
    
    An ai agent has intercepted the above user_reqest and responded with the final_result below:
    <final_result>
      ${planFinalResultAsString}
    </final_result>
    
    ## SUCCESSFUL EXAMPLE #1
    A response of "19" when the final_result is: <final_result>19</final_result>
    
    ## SUCCESSFUL EXAMPLE #2
    A response of "Abraham Lincoln was a Teenage Mutant Ninja Turtle!" when the final_result is: <final_result>Abraham Lincoln was a Teenage Mutant Ninja Turtle!</final_result>
    
    ## SUCCESSFUL EXAMPLE #3
    A response of "<div>one two three</div>" when the final_result is: <final_result><div>one two three</div></final_result>
    
    ## UNSUCCESSFUL EXAMPLE #1
    A response of "The latest bitcoin price is $84" when the final_result is <final_result></final_result>
    
    **Why it fails** The final_result was empty, and therefore you should respond with an empty response.
    
    ## UNSUCCESSFUL EXAMPLE #2
    A response of "## Heading 1 \n Christopher Columbus was a man who sailed the ocean." when the final_result is <final_result><h1> \n Christopher Columbus was a man who sailed the ocean.</h1></final_result>
    
    **Why it fails** The final_result had html formatting, but the response modified the formatting.
  `;
}

function getPromptToTellLlmItMadeAnErrorWhenTryingToCallTools(error: any, userPrompt: string, plannerAgent: PlannerAgent, tools: ChatCompletionTool[]){
  let toolFunctionNames = tools.map(t => t.function.name).join(', ');
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
