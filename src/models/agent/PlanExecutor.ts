import {AgentPlan, AiFunctionStep} from "./AgentPlan";
import { AiFunctionContextV2, AiFunctionResult } from './aiTypes';

const lastResultKey = "$$lastResult$$";

export class PlanExecutor {
  /**
   *
   * @param agentPlan - list of functions to be called by the executor
   * @param aiFunctionContext - the context to use with each function context.
   */
  constructor(private readonly agentPlan: AgentPlan, private readonly aiFunctionContext: AiFunctionContextV2) {
  }

  async executePlanIgnoringHallucinatedFunctions(){
    if(!this.aiFunctionContext.aiFunctionExecutor){
      throw new Error(`PlanExecutor cannot execute a plan without an aiFunctionExecutor`);
    }
    // for (let aiFunctionStep of this.agentPlan.functionSteps){
    //   await executeAiFunctionStep(aiFunctionStep, this.aiFunctionContext);
    // }
    const functionStepsForFunctionsThatExist = getOnlyFunctionStepsThatExistOnFunctionExecutor(this.aiFunctionContext, this.agentPlan);
    for (let aiFunctionStep of functionStepsForFunctionsThatExist){
      await executeAiFunctionStep(aiFunctionStep, this.aiFunctionContext);
    }
  }

  async getFinalResultFromPlan(){
    return this.aiFunctionContext.functionResultsStorage[lastResultKey];
  }
}

function getOnlyFunctionStepsThatExistOnFunctionExecutor(aiFunctionContext: AiFunctionContextV2, agentPlan: AgentPlan){
  return agentPlan.functionSteps.filter(f => typeof aiFunctionContext.aiFunctionExecutor![f.functionName] == 'function');
}

/**
 * execute a function.
 * provide useful functionality:
 * - such as parameter reference swapping with actual values.
 * -- e.g. aiAdd(5, 5) -> aiSubtract("$aiAdd.result", 1)    <- we will replace "$aiAdd.result" with 10.
 * - store results in context under `$functionName.result`
 * -- e.g. aiAdd(5, 5) <- we will store result in context["$aiAdd.result"]
 * -- errors are stored in result as well.
 * - store results in context under `$$lastResult$$` - this probably isn't needed any longer.
 * @param aiFunctionStep
 * @param aiFunctionContext
 */
async function executeAiFunctionStep(aiFunctionStep: AiFunctionStep, aiFunctionContext: AiFunctionContextV2){
  if(!aiFunctionContext.aiFunctionExecutor){ throw new Error('Plan executor attempted to execute an ai function step, but there was not aiFunctionExecutor defined'); }
  const functionNameToExecute = aiFunctionStep.functionName;
  const functionArgs = aiFunctionStep.functionArgumentsPassedByLLM;

  const functionArgsWithReferencesToFunctionResultsSwappedOutWithValues = swapFunctionArgsWithStorageDataIfNeeded(functionArgs, aiFunctionContext.functionResultsStorage);
  aiFunctionStep.functionArgumentsUsedDuringExecution = functionArgsWithReferencesToFunctionResultsSwappedOutWithValues;

  const aiFunctionExecutor = aiFunctionContext.aiFunctionExecutor;
  let aiFunctionResult: AiFunctionResult;
  let result: any;
  try{
    aiFunctionResult = await aiFunctionExecutor[functionNameToExecute](functionArgsWithReferencesToFunctionResultsSwappedOutWithValues, aiFunctionContext);
    result = aiFunctionResult.result;
  }catch(e){
    result = e;
  }

  //store the result of the function in our functionResults so other functions can access the result.
  const resultStorageKey = `$${functionNameToExecute}.result`;
  aiFunctionContext.functionResultsStorage[resultStorageKey] = result;
  aiFunctionContext.functionResultsStorage[lastResultKey] = result;
  aiFunctionStep.result = result;
}

/**
 * Iterate over each property of functionArgs, and if the property looks like a: "$aiAdd.result", swap the value with what's in the store.
 * e.g. if functionResultsStore is {"$aiAdd.result": 5}, and functionArgs is {a: "$aiAdd.result", b: 7},
 * then we will return a new functionArgs object that is:
 * {a: 5, b: 7}
 * @param functionArgs
 * @param functionResultsStore
 */
function swapFunctionArgsWithStorageDataIfNeeded(functionArgs: object, functionResultsStore: object): object {
  //iterate over each functionArgs property and swap its value out, if the value refers to a functionResultsStore key. e.g. "$aiAdd.result"
  const newFunctionArgs = Object.entries(functionArgs).reduce((accumulated, [key, value]) => {
    const swappedValueIfValueReferredToFunctionResultsStorageKey = swapParamValueWithStorageDataIfNeeded(value, functionResultsStore);
    accumulated[key] = swappedValueIfValueReferredToFunctionResultsStorageKey;
    return accumulated;
  }, {});
  return newFunctionArgs;
}

/**
 * If the paramValue is actually a reference to a value in the functionResultsStore, return the value in the store.
 * e.g. if the paramValue is "$aiAdd.result", and the functionResultsStore has "$aiAdd.result": 5,
 * we will return 5.
 * @param paramValue
 * @param functionResultsStore
 */
function swapParamValueWithStorageDataIfNeeded(paramValue: any, functionResultsStore: object): any{
  const regex = /^\$[a-zA-Z_$][a-zA-Z0-9_$]*\.result$/;
  const doesMatch = regex.test(paramValue);
  if(!doesMatch){
    return paramValue;
  }
  //return the paramValue stored in the store.
  const newParamValue = functionResultsStore[paramValue];
  return newParamValue;
}
