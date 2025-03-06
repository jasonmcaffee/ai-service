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

  //Test Summary: 9/30   30.00%
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
   - First call: \`aiCreatePlan\` (always first)
   - Middle calls: \`aiAddFunctionStepToPlan\` (0 or more steps)
   - Last call: \`aiCompletePlan\` (always last)
4. When considering calling aiAddFunctionStepToPlan, understand that no functionName param values should be used, that aren't explicitly defined in the <functionNames> tag.
5. Only respond to this request with tool calls.  Do not respond with any other preamble or text.   
6. Make ALL tool calls for aiCreatePlan and aiCompletePlan in a SINGLE response (do not wait for results between calls). i.e. don't call on aiCreatePlan, wait for the response, then call aiCompletePlan.  
7. After responding with tool calls, you will receive back a success response from the \`aiCompletePlan\` tool.
8. After receiving a response from the tool call to aiCompletePlan, do not respond with any further tool calls. 
Respond with "complete"

## Context
Below is an array of functionName available to you to use when calling aiAddFunctionStepToPlan.
<functionNames>
${functionNames}
</functionNames>

It's important for you to spend time reasoning about these functionNames.  You continue to make calls to aiAddFunctionStepToPlan, passing in functionNames that do not exist in the provided functionNames tag.
Why do you think that is?  

## Parameter Referencing Syntax
When a step depends on a previous step's result, use this as the parameter value to indicate that the previous function result should be used: \`$previousFunctionName.result\`.  e.g. "$aiAdd.result"

## User Prompt
Create a plan using the user prompt below:
<prompt>${userPrompt}</prompt>

## Important things to remember
Remember: For any tool calls you decide to make, they must be done in ONE response.  ie. aiCreatePlan and aiCompletePlan calls must be made in a single response.
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
            doFunctionsExistToFulfillTheUserRequest: {
              type: "boolean",
              description: `indicate whether all functionNames/tools exist in order to fulfill the user reqeust.  
              For example, the user may ask to send an email to Bob@gmail, but a sendEmail functionName/tool may not exist, and if it doesn't exist, this value should be false.
              `
            },
            functionNamesPlanWillCall: {
              type: "array",
              description: `A array of all the functionNames/tools that will be called as part of this plan. i.e. the functionName parameters that will be sent to each aiAddFunctionStepToPlan call.`,
              items: {
                type: "string",
              }
            }
          },
        },
      }
    };
  }
  async aiCreatePlan({id, doFunctionsExistToFulfillTheUserRequest, functionNamesPlanWillCall, functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan}: {id: string, doFunctionsExistToFulfillTheUserRequest: boolean, functionNamesPlanWillCall: string[], functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan: string}, context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiCreatePlan called with id: ${id}, doFunctionNamesExist: ${doFunctionsExistToFulfillTheUserRequest}, functionNamesPlanWillCall: ${JSON.stringify(functionNamesPlanWillCall)}, functionNamesXmlTag: ${functionNamesAvailableForYouToUseInAiAddFunctionStepToPlan}`);
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
        description: `Add a function call step to the current execution plan. `,
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A unique identifier for this function step.",
            },
            functionName: {
              type: "string",
              description: `The name of the function to be called in this step. The value of this must be explicitly defined in the <functionNames> tag.`,
            },
            functionNameIndexInFunctionNamesTag: {
              type: "number",
              description: ``,
            },
            functionArgs: {
              type: "object",
              description: "The arguments that should be passed to the function when executed.",
            },
            reasonToAddStep: {
              type: "string",
              description: "Where you found the functionName in the provided tools. Also a justification for why this function step is necessary to fulfill the user's request.",
            },
          },
          required: ["id", "functionName", "functionArgs", "reasonToAddStep"],
        },
      }
    };
  }
  async aiAddFunctionStepToPlan({ id, functionName, functionArgs, reasonToAddStep, }:
                                  { id: string; functionName: string; functionArgs: object; reasonToAddStep: string; toolIsExplicitlyDefinedInTheToolsXmlTag: boolean;},
                                context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
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

/**
 *
 ## Chain-of-Thought Process
 1. First, identify what the user is asking for
 2. Break down the necessary steps to achieve this goal
 3. Map each step to an appropriate tool.
 3a. If an appropriate tool does not exist in the <tools> xml tag, or the <tools> tag is not defined in a previous message, then skip calling aiAddFunctionStepToPlan.
 3b. Always triple check whether a tool is explicitly defined, with function name, parameters, etc, before attempting to reference it.  Do not reference tools that are not explicitly defined.
 4. Check dependencies between steps
 5. Ensure all steps are necessary and sufficient
 6. Create a complete plan with proper sequencing
 7. Format every tool call as a proper JSON object
 8. Never attempt using a functionName that begins with "exampleFunction", as those functions do not exist.


 ## Tool Call JSON Format
 Format each tool call as a JSON object with "name" and "arguments" fields:

 \`\`\`
 ${toolStartMarker} {"name": "toolName", "arguments": {parameterName: parameterValue, ...}} ${toolEndMarker}
 \`\`\`

 Example:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "my_plan_id"}} ${toolEndMarker}
 \`\`\`

 # Example Scenarios with JSON-Formatted Responses
 NOTE: these examples use "functionName" that start with "exampleFunction" so you know never to use them, as they do not exist and are for example purposes _only_.


 ## SUCCESSFUL EXAMPLE 1: Web Search and Summarize
 **User prompt**: "Find the latest news about climate change and summarize it for me."

 **Successful Response**:
 Note: there is a blank space after aiCompletePlan
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "climate_news_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctionsearchWeb", "functionArgs": {"query": "latest climate change news"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "The function name was clearly listed in <functionNames> which has 'searchWeb' listed inside of the tag. Need to gather recent information on climate change."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "exampleFunctionsummarize", "functionArgs": {"textToSummarize": "$searchWeb.result"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to condense the search results into a readable summary."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to search for and summarize climate change news as requested."}}  ${toolEndMarker}
 \`\`\`

 ## SUCCESSFUL EXAMPLE 2: Multi-Step Calculation
 Note: there is a blank space after aiCompletePlan
 **User prompt**: "Convert 100 USD to EUR, then calculate 15% of that amount."

 **Successful Response**:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "currency_calculation_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctioncurrencyConvert", "functionArgs": {"amount": 100, "from": "USD", "to": "EUR"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to convert USD to EUR as requested."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "exampleFunctioncalculatePercentage", "functionArgs": {"value": "$currencyConvert.result", "percentage": 15}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to calculate 15% of the converted amount."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to convert currency and calculate percentage as requested."}} ${toolEndMarker}
 \`\`\`

 ## UNSUCCESSFUL EXAMPLE 1: Missing Tool Calls
 **User prompt**: "Tell me about the weather in Paris."

 **Problematic Response**:
 \`\`\`
 The weather in Paris is typically mild with temperatures ranging from...
 \`\`\`
 **Why it fails**: The response provides information directly instead of making tool calls to create a plan.

 **Corrected Response**:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "paris_weather_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctiongetWeather", "functionArgs": {"location": "Paris"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to retrieve current weather data for Paris."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides step to get weather information for Paris as requested."}}  ${toolEndMarker}
 \`\`\`

 ## UNSUCCESSFUL EXAMPLE 2: Multiple Responses Instead of One
 **User prompt**: "Create a shopping list with 5 items and calculate the total cost."

 **Problematic Response**:
 First response:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "shopping_list_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctioncreateShoppingList", "functionArgs": {"numItems": 5}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to create a shopping list with 5 items."}} ${toolEndMarker}
 \`\`\`
 Then in a second response:
 \`\`\`
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "exampleFunctioncalculateTotalCost", "functionArgs": {"itemsList": "$createShoppingList.result"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to calculate the total cost of the shopping list."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to create a shopping list and calculate total cost."}} ${toolEndMarker}
 \`\`\`

 **Why it fails**: The LLM split the tool calls across multiple responses instead of including all in one response.

 **Corrected Response**:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "shopping_list_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctioncreateShoppingList", "functionArgs": {"numItems": 5}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to create a shopping list with 5 items."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "exampleFunctioncalculateTotalCost", "functionArgs": {"itemsList": "$createShoppingList.result"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": true, "reasonToAddStep": "Need to calculate the total cost of the shopping list."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to create a shopping list and calculate total cost."}} ${toolEndMarker}
 \`\`\`

 ## UNSUCCESSFUL EXAMPLE 3: Inventing Tools
 You should only refer to tools defined in the <tools> xml tag.
 **User prompt**: "Write an email to my boss asking for a day off."
 ** Tools xml tag: <tools>{type: "function", function: {name: "exampleFunctionGetRecipe", ...} }</tools>
 **Problematic Response**:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "email_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctiongenerateEmail", "functionArgs": {"recipient": "boss", "subject": "Request for Day Off", "purpose": "day off request"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": false, "reasonToAddStep": "Need to draft an email requesting time off."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "exampleFunctionsendEmail", "functionArgs": {"emailContent": "$generateEmail.result"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": false, "reasonToAddStep": "Need to send the generated email."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to create and send an email requesting time off."}} ${toolEndMarker}
 \`\`\`

 **Why it fails**: The LLM invented tools (generateEmail, sendEmail) that weren't provided  in the <tools> tag.

 **Corrected Response **:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "email_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "There are no tools available to fulfill the request. "}} ${toolEndMarker}
 \`\`\`

 ## UNSUCCESSFUL EXAMPLE 4: Inventing Tools
 You should only refer to tools defined in the <tools> xml tag.
 **User prompt**: "What are the headlines for today's news?"
 ** Tools xml tag: <tools></tools>
 **Problematic Response**:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "email_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "exampleFunctionsearchWeb", "functionArgs": {"query": "today's news"}, "toolIsExplicitlyDefinedInTheToolsXmlTag": false, "reasonToAddStep": "Search the web is needed."}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "There are no tools available to fulfill the request"}} ${toolEndMarker}
 \`\`\`

 **Why it fails**: The LLM invented tools (searchWeb) that weren't provided in the <tools> tag.

 **Corrected Response **:
 \`\`\`
 ${toolStartMarker} {"name": "aiCreatePlan", "arguments": {"id": "search_web_plan"}} ${toolEndMarker}
 ${toolStartMarker} {"name": "aiCompletePlan", "arguments": {"completedReason": "There are no tools available to fulfill the request. "}} ${toolEndMarker}
 \`\`\`
 */
