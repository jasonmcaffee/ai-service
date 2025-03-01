/**
 Based on user prompt, create a plan.


 */

import {AgentPlan, FunctionStep} from "./AgentPlan";

/**
 *
 */
export default class PlannerAgent {
  constructor() {}
  agentPlan: AgentPlan;
  getTools(){
    //we need tools that are available, but that we don't necessarily want to use.
  }

  //create plan
  //add step to plan
  //plan complete.
  async aiCreatePlan({}: {}): Promise<AgentPlan>{
    this.agentPlan = new AgentPlan();
    return this.agentPlan;
  }

  async aiAddFunctionStepToPlan({functionName, functionArgs}: {functionName: string, functionArgs: object}){
    const functionStep = new FunctionStep(functionName, functionArgs);
    this.agentPlan.functionSteps.push(functionStep);
  }

  async aiCompletePlan({}: {}){
    //now we can start executing.
  }
}
