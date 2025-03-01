/**
 Based on user prompt, create a plan.


 */

import {AgentPlan, FunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperService} from "../../services/openaiWrapper.service";
import { Model } from '../api/conversationApiModels';
import { LlmToolsService } from '../../services/llmTools.service';

/**
 * Todo: how do we access context between steps?
 * eg. search, summarize
 */

export default class PlannerAgent {
  constructor(private readonly model: Model, openAiWrapperService: OpenaiWrapperService) {}
  agentPlan: AgentPlan;

  getTools(){
    return [
      PlannerAgent.getAiCreatePlanToolMetadata(),
      PlannerAgent.getAiAddFunctionStepToPlanMetadata(),
      PlannerAgent.getAiCompletePlanMetadata(),

      //Tools available which should not be called.
      LlmToolsService.getSearchWebOpenAIMetadata(),
    ]
  }

  static getAiCreatePlanToolMetadata() {
    return {
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
        properties: {},
      },
    };
  }
  async aiCreatePlan({}: {}): Promise<AgentPlan> {
    this.agentPlan = new AgentPlan();
    return this.agentPlan;
  }

  static getAiAddFunctionStepToPlanMetadata() {
    return {
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
    };
  }
  async aiAddFunctionStepToPlan({ id, functionName, functionArgs, reasonToAddStep, }: { id: string; functionName: string; functionArgs: object; reasonToAddStep: string; }) {
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }

    const functionStep = new FunctionStep(id, functionName, functionArgs, reasonToAddStep);
    this.agentPlan.functionSteps.push(functionStep);
  }

  static getAiCompletePlanMetadata() {
    return {
      name: "aiCompletePlan",
      description: `Finalize the execution plan, signaling that all necessary function steps have been added. 
        
        This function should be called after:
        1. 'aiCreatePlan' has been used to initialize a plan.
        2. 'aiAddFunctionStepToPlan' has been used to add all required function calls.
        
        Once this function is called, your work is done.`,
      parameters: {
        type: "object",
        properties: {},
      },
    };
  }
  async aiCompletePlan({}: {}) {
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }

    // this.agentPlan.isComplete = true;
  }

}
