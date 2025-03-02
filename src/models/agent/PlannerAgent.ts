/**
 Based on user prompt, create a plan.
 */

import {AgentPlan, FunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperService} from "../../services/openaiWrapper.service";
import { Model } from '../api/conversationApiModels';
import { LlmToolsService } from '../../services/llmTools.service';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import InferenceSSESubject from '../InferenceSSESubject';
import { chatPageSystemPrompt } from '../../utils/prompts';
import { CalculatorTools } from './CalculatorTools';
import {AiFunctionContext, AiFunctionExecutor, AiFunctionResult} from "./AiFunctionExecutor";

/**
 * Todo: how do we access context between steps?
 * eg. search, summarize
 */


//doing this mainly to test functionality.  not really needed for this implementation.
class PlannerAgentFunctionContext implements AiFunctionContext {
  public aiCreatePlanResult: AgentPlan;
  constructor(public inferenceSSESubject: InferenceSSESubject | undefined, ) {
  }
}

export default class PlannerAgent implements AiFunctionExecutor<PlannerAgent> {
  constructor(private readonly model: Model, private readonly openAiWrapperService: OpenaiWrapperService, private readonly memberId) {}
  agentPlan: AgentPlan;

  getOpenAiMetadataForTools(): ChatCompletionTool[]{
    return [
      PlannerAgent.getAiCreatePlanToolMetadata(),
      PlannerAgent.getAiAddFunctionStepToPlanMetadata(),
      PlannerAgent.getAiCompletePlanMetadata(),

      CalculatorTools.getAiAddMetadata(),
      CalculatorTools.getAiMultiplyMetadata(),
      CalculatorTools.getAiSubtractMetadata(),
      CalculatorTools.getAiDivideMetadata(),
    ]
  }

  async createPlan(userPrompt: string){
    const abortController = new AbortController();
    const inferenceSSESubject = new InferenceSSESubject();
    const aiFunctionContext = new PlannerAgentFunctionContext(inferenceSSESubject);

    let completeText = '';
    const result = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages: [{ role: 'system', content: this.getCreatePlanPrompt(userPrompt)}],
      handleOnText: (text)=> {
        completeText += text;
      },
      abortController, inferenceSSESubject, model: this.model, memberId: this.memberId, tools: this.getOpenAiMetadataForTools(),
      toolService: this, aiFunctionContext,
    });
    console.log(`plannerAgent completeText streamed: `, completeText);
    return result;
  }

  getCreatePlanPrompt(userPrompt: string){
    return `
    You are an AI Agent, equipped with tools/functions that are described to you in detail, that is solely tasked with understanding a user prompt and coming up with a plan (series of steps that include things like tool calls) that can be used to respond to the user prompt..
    You are not tasked with responding the user prompt, as that will be done by another agent, which will use the plan that you've come up with, in order to respond to the user's prompt.

    Use only the tools provided to you when creating a plan.  Do not make up tools that aren't provided.  Do your best with the tools provided.
    
    For example, if the user prompt is "search the web for news and summarize what happened today", and you were provided a tool to search the web, a tool for summary, and tools for creating a plan, your tool calls might look something like:
    - call tool aiCreatePlan, which is needed in order to add steps
    - call tool aiAddFunctionStepToPlan, passing an argument { id: "1", functionName: "searchWeb"; functionArgs: {"query": "latest music industry news"}, reasonToAddStep: "This step is needed to find information regarding the user's request." }  
    - call tool aiAddFunctionStepToPlan, passing an argument { id: "2", functionName: "summarize"; functionArgs: {"textToSummarize": "example text"}, reasonToAddStep: "This step is needed to fulfill the user's request." }  
    - call tool aiCompletePlan, which is needed to indicate the plan has been completed.
    - receive {success: true} from call to aiCompletePlan.
    - respond with 'complete'
    All of your tool calls should be done at the same time. i.e. aiCreatePlan, aiAddFunctionStepToPlan, and aiCompletePlan should be in a single response from you.
    e.g. Do not wait for the result of a tool before calling aiCompletePlan.
    
    Once the aiCompletePlan function is called, you will receive a response message with {success: true}, at which point your work is done, and you should make no further tool calls.  Simply respond with 'complete'.
    
    The user prompt is found in the prompt xml tags below:
    <prompt>${userPrompt}</prompt>
    
    Remember, you should only be calling tools related to creating a plan.  When aiAddFunctionStepToPlan is called, you can reference the other tools that were given to you, if needed.
    You *must* call aiCompletePlan when finished adding steps!
    
    Do not use preamble in your response.  Do not respond with anything other than tool calls.  If you were not sent appropriate tools, do not respond at all.
    `;
  }
  static getAiCreatePlanToolMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiCreatePlan",
        description: `Initialize a new execution plan for fulfilling the user's request.
        
        This function must be called **first** before adding any function steps.
        
        **Usage Instructions:**
        1. Call this function to start a new plan.
        2. Then, use 'aiAddFunctionStepToPlan' to add each required function call.
        3. Once all steps have been added, finalize the plan by calling 'aiCompletePlan'.

        The plan serves as a structured sequence of tool calls necessary to accomplish the request.`,
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A unique identifier for this plan",
            },
          },
        },
      }
    };
  }
  async aiCreatePlan({id}: {id: string}, context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiCreatePlan called with id: ${id}`);
    this.agentPlan = new AgentPlan(id);
    context.aiCreatePlanResult = this.agentPlan;
    return {
      result: {success: true},
      context,
    };
  }

  //{"name": "searchWeb", "arguments": {"query": "latest music industry news"}}
  static getAiAddFunctionStepToPlanMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiAddFunctionStepToPlan",
        description: `Add a function call step to the current execution plan. 
          
          Each step represents a specific function call that will be executed as part of the plan.
          
          Guidelines:
          - Ensure the function is necessary for fulfilling the request.
          - Provide a clear reason for adding this function step.
          - Define arguments precisely to avoid ambiguity.
          
          Call this function multiple times to add all required function steps before finalizing with 'aiCompletePlan'.`,
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A unique identifier for this function step.",
            },
            functionName: {
              type: "string",
              description: "The name of the function to be called in this step.",
            },
            functionArgs: {
              type: "object",
              description: "The arguments that should be passed to the function when executed.",
            },
            reasonToAddStep: {
              type: "string",
              description: "A justification for why this function step is necessary to fulfill the user's request.",
            },
          },
          required: ["id", "functionName", "functionArgs", "reasonToAddStep"],
        },
      }
    };
  }
  async aiAddFunctionStepToPlan({ id, functionName, functionArgs, reasonToAddStep, }:
                                { id: string; functionName: string; functionArgs: object; reasonToAddStep: string; },
                                context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiAddFunctionStepToPlan called with: `, {id, functionName, functionArgs, reasonToAddStep});
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }
    if(this.agentPlan == context.aiCreatePlanResult){ //testing
      console.log(`it works!!`);
    }
    const functionStep = new FunctionStep(id, functionName, functionArgs, reasonToAddStep);
    this.agentPlan.functionSteps.push(functionStep);
    return {
      result: {success: true},
      context
    };
  }

  static getAiCompletePlanMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiCompletePlan",
        description: `You must call this function when you have finished adding steps!  Do not skip this for any reason.  
        Finalize the execution plan, signaling that all necessary function steps have been added. 
        
        This function should be called after:
        1. 'aiCreatePlan' has been used to initialize a plan.
        2. 'aiAddFunctionStepToPlan' has been used to add all required function calls.
        
        Once this function is called, you will receive a response message with {success: true}, at which point your work is done, and you should make no further tool calls.  Simply respond with 'complete'`,
        parameters: {
          type: "object",
          properties: {
            completedReason: {
              type: "string",
              description: "Reason the plan is considered complete.  e.g. All steps have been created needed to fulfill the user request.",
            },
          },
        },
      }
    };
  }
  async aiCompletePlan({completedReason}: {completedReason: string}, context: AiFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiCompletePlan called with: `, {completedReason});
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }
    return {
      result: {success: true},
      context
    };
  }

}
