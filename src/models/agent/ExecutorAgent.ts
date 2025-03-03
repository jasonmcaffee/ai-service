import {AgentPlan, AiFunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperService} from "../../services/openaiWrapper.service";
import { AiFunction, AiFunctionContext } from './aiTypes';

export class ExecutorAgent{
  /**
   *
   * @param agentPlan - list of functions to be called by the executor
   * @param aiFunctionContext - the context to use with each function context.
   */
  constructor(private readonly agentPlan: AgentPlan, private readonly aiFunctionContext: AiFunctionContext) {
  }

  async executePlan(){
    for (let aiFunctionStep of this.agentPlan.functionSteps){

    }
  }


}

/**
 * execute a function.
 * provide useful functionality:
 * - such as parameter reference swapping with actual values.
 * -- e.g. aiAdd(5, 5) -> aiSubtract("$aiAdd.result", 1)    <- we will replace "$aiAdd.result" with 10.
 * - store results in context
 * -- e.g. aiAdd(5, 5) <- we will store result in context["$aiAdd.result"]
 * - store errors in context
 * -- e.g. aiAdd("x", 1)  <- will store error in context["$aiAdd.error"]
 * @param aiFunctionStep
 * @param aiFunctionContext
 */
async function executeAiFunctionStep(aiFunctionStep: AiFunctionStep, aiFunctionContext: AiFunctionContext){
  aiFunctionStep.args

  //iterate over each arg and see if it's $aiAdd.result format.
  //if so, replace it.
}
