/**
 Based on user prompt, create a plan.
 */

//https://github.com/ggml-org/llama.cpp/issues/11866
//https://github.com/user-attachments/files/18814154/Qwen2.5-1.5B-Instruct.jinja.txt

import {AgentPlan, AiFunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperServiceV2} from "../../services/openAiWrapperV2.service";
import { Model } from '../api/conversationApiModels';
import { WebToolsService } from '../../services/agent/tools/webTools.service';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import InferenceSSESubject from '../InferenceSSESubject';
import { getChatPageSystemPrompt, getToolsPrompt, toolCallEndMarker, toolCallStartMarker } from '../../utils/prompts';
import { CalculatorToolsService } from '../../services/agent/tools/calculatorTools.service';
import { AiFunctionContext, AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult } from './aiTypes';
import { chatCompletionTool } from '../../services/agent/tools/aiToolTypes';

//doing this mainly to test functionality.  not really needed for this implementation.
class PlannerAgentFunctionContext implements AiFunctionContextV2 {
  public aiCreatePlanResult: AgentPlan;
  public functionResults = {};//where we house "$aiAdd.result" etc
  constructor(
    public memberId: string,
    public inferenceSSESubject: InferenceSSESubject | undefined,
    public aiFunctionExecutor: AiFunctionExecutor<PlannerAgentV2>,
    public abortController: AbortController,
  ) {}
}

export default class PlannerAgentV2 implements AiFunctionExecutor<PlannerAgentV2> {
  constructor(private readonly model: Model,
              private readonly openAiWrapperServiceV2: OpenaiWrapperServiceV2,
              private readonly memberId,
              private readonly aiFunctionExecutor: AiFunctionExecutor<any>,
              private readonly inferenceSSESubject: InferenceSSESubject | undefined,
              private readonly originalOpenAiMessages: ChatCompletionMessageParam[]
  ) {}
  agentPlan: AgentPlan;
  public isPlanCreationComplete: boolean;

  getToolsMetadata(): ChatCompletionTool[]{
    return [
      PlannerAgentV2.getAiCreatePlanToolMetadata(),
      // PlannerAgentV2.getAiAddFunctionStepToPlanMetadata(),
      // PlannerAgentV2.getAiCompletePlanMetadata(),
      ...this.aiFunctionExecutor.getToolsMetadata(),
    ]
  }

  async createPlan(userPrompt: string){
    this.isPlanCreationComplete = false;
    const abortController = new AbortController();
    const aiFunctionContext = new PlannerAgentFunctionContext(this.memberId, this.inferenceSSESubject, this, abortController);

    const result = await this.openAiWrapperServiceV2.callOpenAiUsingModelAndSubject({
      openAiMessages: [
        ...this.originalOpenAiMessages,
        // { role: 'system', content: getToolsPrompt(this.getToolsMetadata())},
        { role: 'system', content: this.getCreatePlanPrompt(userPrompt, this.getToolsMetadata())}
      ],
      model: this.model,
      aiFunctionContext,
      totalOpenAiCallsMade: 0,
    });
    return {...result, agentPlan: this.agentPlan};
  }

  /**
   This helped stop hallucinating:
   It's important for you to spend time reasoning about these functionNames.  You continue to make calls to aiAddFunctionStepToPlan, passing in functionNames that do not exist in the provided functionNames tag.
   Why do you think that is?



   * @param userPrompt
   * @param toolsMetadata
   */
  getCreatePlanPrompt(userPrompt: string, toolsMetadata: ChatCompletionTool[]){
    const functionNames = `[${toolsMetadata.filter(f => f.function.name !== 'aiCreatePlan').map(t => t.function.name).join(', ')}]`
    return `
# Planning Agent Instructions

## Your Role
You are a Planning Agent whose ONLY responsibility is to create a structured plan of tool calls to address the user's prompt. Another agent will execute your plan, so focus exclusively on planning, not execution.
You are only to call the aiCreatePlan tool, passing functionStep arguments which refer to tools provided to you.
It is valid to have a plan that includes no function steps.  This is particularly important to understand, and for you to avoid inventing functionNames that aren't explicitly provided to you.

## Expected Process (Follow This Exactly)
1. Analyze the user prompt carefully
2. Analyze the functionNames tag carefully.  
3. Only call the tool named aiCreatePlan, creating a plan, passing an array of functionSteps to add to the plan.
4. When considering passing the functionSteps understand that no functionName param values should be used that aren't explicitly defined in the <functionNames> tag.

## Context
Below is an array of functionName available to you to use when reasoning about which function steps to use:
<functionNames>
${functionNames}
</functionNames>

It's important for you to spend time reasoning about these function names. 

For example, if functionNames contains <fuctionNames>[aiAdd]</fuctionNames>, and the user prompt is 'send a letter to July', you should recognize that there is no function available to send a letter, and therefore should
not attempt to pass a function step for that user request.

## Function Step Parameter Referencing Syntax
When a function step depends on a previous function step's result, use this as the parameter value to indicate that the previous function result should be used: \`$previousFunctionName.result\`.  e.g. "$aiAdd.result"

## User Prompt
Create a plan using the user prompt below:
<prompt>${userPrompt}</prompt>

## Valid JSON Responses
It is extremely important that all JSON that you write be strictly valid JSON.
Spend time reasoning and ensuring that all JSON is 100% valid, and has appropriate closing }, ], etc.

## Important Things To Remember
You are only allowed to call the aiCreatePlan tool, passing in function steps that another agent will execute.  You are not allowed to directly call any other tools.

`;
  }
  static getAiCreatePlanToolMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiCreatePlan",
        description: `Initialize a new execution plan for fulfilling the user's request.`,
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A unique identifier for this plan",
            },
            functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan: {
              type: "string",
              description: `the exact value of the <functionNames> xml tag.`,
            },
            doAllFunctionsExistToFulfillTheUserRequest: {
              type: "boolean",
              description: `boolean to indicate whether all functionNamesPlanWillCall all are explicitly defined in <functionNames>.`
            },
            functionNamesPlanWillCall: {
              type: "array",
              description: `A array of all the functionNames/tools that will be called as part of this plan. `,
              items: {
                type: "string",
              }
            },
            functionSteps : {
              type: "array",
              description: `Array of functions to execute in order to fulfill the user's request, where only the functions provided in tools & <functionNames> are referenced.`,
              items: {
                type: "object",
                properties: {
                  functionName: {
                    type: "string",
                    description: `The name of the function to be called in this step. The value of this must be explicitly defined in the <functionNames> tag.`,
                  },
                  functionNameIndexInFunctionNamesTag: {
                    type: "number",
                    description: `The index of the array defined in <functionNames> where the functionName was found.`,
                  },
                  functionArgs: {
                    type: "object",
                    description: "The arguments that should be passed to the function when executed.  Results from previous function calls can be referenced using `$functionName.result`",
                  },
                  reasonToAddStep: {
                    type: "string",
                    description: "Justification for why this function step is necessary to fulfill the user's request.",
                  },
                }
              }
            }
          },
          required: ["id", "functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan", "doAllFunctionsExistToFulfillTheUserRequest", "functionNamesPlanWillCall", "functionSteps"],
        },
      }
    };
  }
  async aiCreatePlan({id, doAllFunctionsExistToFulfillTheUserRequest, functionNamesPlanWillCall, functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan, functionSteps}:
                       {id: string, doAllFunctionsExistToFulfillTheUserRequest: boolean, functionNamesPlanWillCall: string[], functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan: string, functionSteps: object[]},
                     context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiCreatePlan called with id: ${id}, doFunctionNamesExist: ${doAllFunctionsExistToFulfillTheUserRequest}, 
      functionNamesPlanWillCall: ${JSON.stringify(functionNamesPlanWillCall)}, 
      functionNamesXmlTag: ${functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan}, 
      functionSteps: ${JSON.stringify(functionSteps)}`);
    this.agentPlan = new AgentPlan(id, doAllFunctionsExistToFulfillTheUserRequest);
    this.agentPlan.functionSteps = createAiFunctionStepsFromAiResponse(functionSteps);
    context.aiCreatePlanResult = this.agentPlan;
    return {
      result: {success: true},
      context,
    };
  }



}

function createAiFunctionStepsFromAiResponse(functionStepsAiResponse: object[]): AiFunctionStep[]{
  const result: AiFunctionStep[] = [];
  for(let functionStepAiResponse of functionStepsAiResponse){
    //@ts-ignore
    const {functionName, functionNameIndexInFunctionNamesTag, functionArgs, reasonToAddStep} = functionStepAiResponse;
    const aiFunctionStep = new AiFunctionStep("id", functionName, functionArgs, reasonToAddStep);
    result.push(aiFunctionStep);
  }
  return result;
}
