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
      PlannerAgentV2.getAiAddFunctionStepToPlanMetadata(),
      PlannerAgentV2.getAiCompletePlanMetadata(),
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
    const functionNames = `[${toolsMetadata.map(t => t.function.name).join(', ')}]`
    return `
# Planning Agent Instructions

## Your Role
You are a Planning Agent whose ONLY responsibility is to create a structured plan of tool calls to address the user's prompt. Another agent will execute your plan, so focus exclusively on planning, not execution.
It is valid to have a plan that includes no function steps.  This is particularly important to understand, and for you to avoid inventing functionNames that aren't explicitly provided to you.

## Expected Process (Follow This Exactly)
1. Analyze the user prompt carefully
2. Analyze the functionNames tag carefully.  
3. Create a sequential plan using ONLY the provided planning tools:
   - First create a plan: \`aiCreatePlan\` 
   - Next, optionally add function steps to the plan: \`aiAddFunctionStepToPlan\` (optional) - spend time deeply reasoning about if this call is valid, knowing that only functionNames that are defined in <functionNames> can be referrenced. 
   - Finally, mark the plan as complete: \`aiCompletePlan\` 
4. When considering calling aiAddFunctionStepToPlan, understand that no functionName param values should be used, that aren't explicitly defined in the <functionNames> tag.
5. Only respond to this request with tool calls.  Do not respond with any other preamble or text.   
6. All tool calls made by you should be done in ONE response.  ie. You should call all tools needed for a user prompt directly after a user prompt is received.
7. Since all tool calls must happen at once, when a tool call depends on the result of a previous tool call, use parameter referencing syntax \`$functionName.result\` for dependencies.   
  ### Example of a good tool execution flow
  user prompt: "find the email address for member id 1, then send them a welcome email"
  your response: 2 tool calls in a single response.
    1. aiCreatePlan
    2. aiCompletePlan
  
  ### Example of a bad tool execution flow
  user prompt: "find the email address for member id 1, then send them a welcome email"
  your response: 1 tool call in the first response.
    1. aiCreatePlan
  client: sends result of findEmail back to you
  your response: 1 tool call in the second response  
    1. aiCompletePlan
7. After responding with tool calls, you will receive back a success response from the aiCompletePlan tool.
8. After receiving a response from the tool call to aiCompletePlan, do not respond with any further tool calls. 
Respond simply with "complete".

## Context
Below is an array of functionName available to you to use when calling aiAddFunctionStepToPlan.
<functionNames>
${functionNames}
</functionNames>

It's important for you to spend time reasoning about these functionNames.  You continue to make calls to aiAddFunctionStepToPlan, passing in functionNames that do not exist in the provided functionNames tag.

For example, if functionNames contains <fuctionNames>[aiAdd]</fuctionNames>, and the user prompt is 'send a letter to July', you should recognize that there is no tool available to send a letter, and therefore should
not attempt to call aiAddFunctionStepToPlan for that user request.
It's imperative that you do not attempt to pass functionNames that don't exist in <functionNames>.

## Parameter Referencing Syntax
When a step depends on a previous step's result, use this as the parameter value to indicate that the previous function result should be used: \`$previousFunctionName.result\`.  e.g. "$aiAdd.result"

## User Prompt
Create a plan using the user prompt below:
<prompt>${userPrompt}</prompt>

## Important things to remember
Remember: For any tool calls you decide to make, they must be done in ONE response.  ie. a call to aiCreatePlan must be accompanied by a call to aiCompletePlan.  This is extremely important.
Remember: aiAddFunctionStepToPlan is optional, but if used, it can only refer to a functionName found in <functionNames>.

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
              description: `the exact value of the <functionNames> xml tag, which was provided to you as a reference to which functions are available to you when calling aiAddFunctionStepToPlan.`,
            },
            doAllFunctionsExistToFulfillTheUserRequest: {
              type: "boolean",
              description: `boolean to indicate whether all functionNamesPlanWillCall all are explicitly defined in <functionNames>.`
            },
            functionNamesPlanWillCall: {
              type: "array",
              description: `A array of all the functionNames/tools that will be called as part of this plan. i.e. the functionName parameters that will be sent to each aiAddFunctionStepToPlan call.`,
              items: {
                type: "string",
              }
            }
          },
          required: ["id", "functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan", "doAllFunctionsExistToFulfillTheUserRequest", "functionNamesPlanWillCall"],
        },
      }
    };
  }
  async aiCreatePlan({id, doAllFunctionsExistToFulfillTheUserRequest, functionNamesPlanWillCall, functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan}:
                       {id: string, doAllFunctionsExistToFulfillTheUserRequest: boolean, functionNamesPlanWillCall: string[], functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan: string},
                     context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiCreatePlan called with id: ${id}, doFunctionNamesExist: ${doAllFunctionsExistToFulfillTheUserRequest}, functionNamesPlanWillCall: ${JSON.stringify(functionNamesPlanWillCall)}, functionNamesXmlTag: ${functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan}`);
    this.agentPlan = new AgentPlan(id, doAllFunctionsExistToFulfillTheUserRequest);

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
        description: `Add a function call step to the current execution plan. `,
        parameters: {
          type: "object",
          properties: {
            // id: {
            //   type: "string",
            //   description: "A unique identifier for this function step.",
            // },
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
              description: "The arguments that should be passed to the function when executed.",
            },
            reasonToAddStep: {
              type: "string",
              description: "Justification for why this function step is necessary to fulfill the user's request.",
            },
          },
          required: ["functionName", "functionArgs", "reasonToAddStep", "functionNameIndexInFunctionNamesTag"],
        },
      }
    };
  }
  async aiAddFunctionStepToPlan({ functionName, functionArgs, reasonToAddStep, }:
                                  { functionName: string; functionArgs: object; reasonToAddStep: string; toolIsExplicitlyDefinedInTheToolsXmlTag: boolean;},
                                context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    const id = "not used";
    console.log(`aiAddFunctionStepToPlan called with: `, {id, functionName, functionArgs, reasonToAddStep,});
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }

    const functionStep = new AiFunctionStep(id, functionName, functionArgs, reasonToAddStep,);
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
        description: `Indicate that the plan creation process is completed.`,
        parameters: {
          type: "object",
          properties: {
            completedReason: {
              type: "string",
              description: `Reason the plan is considered complete.  
              e.g. Missing available functionNames to help facilitate user's request.
              e.g. All steps have been created needed to fulfill the user request.`,
            },
          },
          required: ["completedReason"],
        },
      }
    };
  }
  async aiCompletePlan({completedReason}: {completedReason: string}, context: AiFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiCompletePlan called with: `, {completedReason});
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }
    this.isPlanCreationComplete = true;
    return {
      result: {success: true},
      context
    };
  }

}



// @chatCompletionTool({
//   type: "function",
//   function: {
//     name: "aiMissingFunctionNameToFulfillUserRequest",
//     description: `When the user request/prompt requires a functionName that isn't defined in <functionNames>, this should be called`,
//     parameters: {
//       type: "object",
//       properties: {
//         partOfUserRequestThatRequiresMissingFunctionName: {
//           type: "string",
//           description: `Which part of the user's request/prompt that requires a functionName that isn't defined in <functionNames>`
//         },
//         nameOfMissingFunctionName: {
//           type: "string",
//           description: "If there were to be a functionName in <functionNames> which could be used to fulfill the user's request, what would it be called? e.g. aiCreateWikipediaEntry when the user asks to create a wikipedia entry about Romans."
//         }
//       }
//     }
//   }
// })
// async aiMissingFunctionNameToFulfillUserRequest({partOfUserRequestThatRequiresMissingFunctionName, nameOfMissingFunctionName}: {partOfUserRequestThatRequiresMissingFunctionName: string, nameOfMissingFunctionName: string}, context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
//   console.log(`aiMissingFunctionNameToFulfillUserRequest called with prompt: ${partOfUserRequestThatRequiresMissingFunctionName}, missing function name: ${nameOfMissingFunctionName}`);
//   return {result: true, context};
// }
