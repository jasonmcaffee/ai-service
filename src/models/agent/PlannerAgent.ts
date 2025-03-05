/**
 Based on user prompt, create a plan.
 */

//https://github.com/ggml-org/llama.cpp/issues/11866
//https://github.com/user-attachments/files/18814154/Qwen2.5-1.5B-Instruct.jinja.txt

import {AgentPlan, AiFunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperService} from "../../services/openaiWrapper.service";
import { Model } from '../api/conversationApiModels';
import { WebToolsService } from '../../services/agent/tools/webTools.service';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import InferenceSSESubject from '../InferenceSSESubject';
import { getChatPageSystemPrompt, getToolsPrompt, toolCallEndMarker, toolCallStartMarker } from '../../utils/prompts';
import { CalculatorToolsService } from '../../services/agent/tools/calculatorTools.service';
import {AiFunctionContext, AiFunctionExecutor, AiFunctionResult} from "./aiTypes";

//doing this mainly to test functionality.  not really needed for this implementation.
class PlannerAgentFunctionContext implements AiFunctionContext {
  public aiCreatePlanResult: AgentPlan;
  public functionResults = {};//where we house "$aiAdd.result" etc
  constructor(public inferenceSSESubject: InferenceSSESubject | undefined, public aiFunctionExecutor: AiFunctionExecutor<PlannerAgent>) {
  }
}

export default class PlannerAgent implements AiFunctionExecutor<PlannerAgent> {
  constructor(private readonly model: Model, private readonly openAiWrapperService: OpenaiWrapperService,
              private readonly memberId, private readonly aiFunctionExecutor: AiFunctionExecutor<any>,
              private readonly inferenceSSESubject: InferenceSSESubject,
              private readonly originalOpenAiMessages: ChatCompletionMessageParam[]
              ) {}
  agentPlan: AgentPlan;
  public isPlanCreationComplete: boolean;

  //TODO MAKE THIS BETTER.  PlannerAgent should be given a AiFunctionExecutor, then iterate.
  getToolsMetadata(): ChatCompletionTool[]{
    return [
      PlannerAgent.getAiCreatePlanToolMetadata(),
      PlannerAgent.getAiAddFunctionStepToPlanMetadata(),
      PlannerAgent.getAiCompletePlanMetadata(),
      ...this.aiFunctionExecutor.getToolsMetadata(),
    ]
  }

  async createPlan(userPrompt: string){
    this.isPlanCreationComplete = false;
    const abortController = new AbortController();
    const aiFunctionContext = new PlannerAgentFunctionContext(this.inferenceSSESubject, this);

    const result = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages: [
          ...this.originalOpenAiMessages,
          { role: 'system', content: getToolsPrompt(this.getToolsMetadata())}, //TODO: this might be duplicate. could do ensureGetToolsPromptExists(openAiMessages)
          { role: 'system', content: this.getCreatePlanPrompt(userPrompt)}
      ],
      abortController, inferenceSSESubject: this.inferenceSSESubject, model: this.model, memberId: this.memberId, tools: this.getToolsMetadata(),
      toolService: this,
      aiFunctionContext,
    });
    return {...result, agentPlan: this.agentPlan};
  }

  //Test Summary: 9/30   30.00%
  getCreatePlanPrompt(userPrompt: string){
    const toolStartMarker = toolCallStartMarker;
    const toolEndMarker = toolCallEndMarker;
    return `
# Planning Agent Instructions

## Your Role
You are a Planning Agent whose ONLY responsibility is to create a structured plan of tool calls to address the user's prompt. Another agent will execute your plan, so focus exclusively on planning, not execution.

## Expected Process (Follow This Exactly)
1. Analyze the user prompt carefully
2. Identify required tools from those provided to you in the <tools> tag.  
3. If no tools exist that can be used to satisfy the user request, you should create a plan with 0 steps.
4. Create a sequential plan using ONLY the provided planning tools:
   - First call: \`aiCreatePlan\` (always first)
   - Middle calls: \`aiAddFunctionStepToPlan\` (0 or more steps)
   - Last call: \`aiCompletePlan\` (always last)
5. Only respond to this request with tool calls.  Do not respond with any other preamble or text.   
6. Make ALL tool calls in a SINGLE response (do not wait for results between calls)
7. After responding with tool calls, you will receive back a success response from the \`aiCompletePlan\` tool.
8. After receiving \`{success: true}\` from \`aiCompletePlan\`, respond only with a blank space. e.g. ' '  This is extremely important.

## Critical Rules
- For this request, Call ONLY the planning tools (aiCreatePlan, aiAddFunctionStepToPlan, aiCompletePlan)
- Reference other provided tools ONLY as steps in your plan.
- NEVER invent tools that weren't provided to you in the <tools> tag.
- all functionName paramater values must exist in the <functionNames> tag.
- You should never attempt using a functionName that isn't explicitly listed inside the <functionNames> tag.
- Make ALL tool calls in ONE response
- Use parameter referencing syntax \`$functionName.result\` for dependencies
- ALWAYS end your plan with aiCompletePlan
- NO explanatory text, preambles, or dialogue - ONLY tool calls
- Format all tool calls as proper JSON objects

## Parameter Referencing Syntax
When a step depends on a previous step's result, use this as the parameter value to indicate that the previous function result should be used: \`$previousFunctionName.result\`.  e.g. "$aiAdd.result"

## User Prompt
<prompt>${userPrompt}</prompt>

Remember: You MUST call all tools (aiCreatePlan → aiAddFunctionStepToPlan → aiCompletePlan) in ONE response.

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
              description: `The name of the function to be called in this step.  This must be explicitly defined in the <tools> xml tag.
              `,
            },
            functionArgs: {
              type: "object",
              description: "The arguments that should be passed to the function when executed.",
            },
            reasonToAddStep: {
              type: "string",
              description: "Where you found the functionName in the <tools> xml tag. Also a justification for why this function step is necessary to fulfill the user's request.",
            },
            toolIsExplicitlyDefinedInTheToolsXmlTag: {
              type: "boolean",
              description: `Any passed functionName must be explicitly be defined in the <tools> xml tag, and this param should indicate that you have verified that the functionName is explicitly defined in the <tools> xml tag.
              `
            }
          },
          required: ["id", "functionName", "functionArgs", "reasonToAddStep", "toolIsExplicitlyDefinedInTheToolsXmlTag"],
        },
      }
    };
  }
  async aiAddFunctionStepToPlan({ id, functionName, functionArgs, reasonToAddStep, toolIsExplicitlyDefinedInTheToolsXmlTag, }:
                                { id: string; functionName: string; functionArgs: object; reasonToAddStep: string; toolIsExplicitlyDefinedInTheToolsXmlTag: boolean;},
                                context: PlannerAgentFunctionContext): Promise<AiFunctionResult> {
    console.log(`aiAddFunctionStepToPlan called with: `, {id, functionName, functionArgs, reasonToAddStep, toolIsExplicitlyDefinedInTheToolsXmlTag});
    if (!this.agentPlan) {
      throw new Error("No active plan found. Call 'aiCreatePlan' first.");
    }

    const functionStep = new AiFunctionStep(id, functionName, functionArgs, reasonToAddStep, toolIsExplicitlyDefinedInTheToolsXmlTag);
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
