/**
 Based on user prompt, create a plan.


 */

import {AgentPlan, FunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperService} from "../../services/openaiWrapper.service";

/**
 * Todo: how do we access context between steps?
 * eg. search, summarize
 */

export default class PlannerAgent {
  constructor(private readonly modelService: ModelsService, openAiWrapperService: OpenaiWrapperService) {}
  agentPlan: AgentPlan;
  getTools(){
    //we need tools that are available, but that we don't necessarily want to use.
  }

  async aiCreatePlan({}: {}): Promise<AgentPlan>{
    this.agentPlan = new AgentPlan();
    return this.agentPlan;
  }

  async aiAddFunctionStepToPlan({id, functionName, functionArgs, reasonToAddStep}: {id: string, functionName: string, functionArgs: object, reasonToAddStep: string}){
    const functionStep = new FunctionStep(id, functionName, functionArgs, reasonToAddStep);
    this.agentPlan.functionSteps.push(functionStep);
  }

  async aiCompletePlan({}: {}){
    //now we can start executing.

  }
}
