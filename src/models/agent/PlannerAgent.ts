/**
 Based on user prompt, create a plan.
 */

//https://github.com/ggml-org/llama.cpp/issues/11866
//https://github.com/user-attachments/files/18814154/Qwen2.5-1.5B-Instruct.jinja.txt

import {AgentPlan, AiFunctionStep} from "./AgentPlan";
import {ModelsService} from "../../services/models.service";
import {OpenaiWrapperService} from "../../services/openaiWrapper.service";
import { Model } from '../api/conversationApiModels';
import { LlmToolsService } from '../../services/agent/tools/llmTools.service';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import InferenceSSESubject from '../InferenceSSESubject';
import {getChatPageSystemPrompt, getToolsPrompt} from '../../utils/prompts';
import { CalculatorTools } from './tools/CalculatorTools';
import {AiFunctionContext, AiFunctionExecutor, AiFunctionResult} from "./aiTypes";

//doing this mainly to test functionality.  not really needed for this implementation.
class PlannerAgentFunctionContext implements AiFunctionContext {
  public aiCreatePlanResult: AgentPlan;
  public functionResults = {};//where we house "$aiAdd.result" etc
  constructor(public inferenceSSESubject: InferenceSSESubject | undefined, public aiFunctionExecutor: AiFunctionExecutor<PlannerAgent>) {
  }
}

export default class PlannerAgent implements AiFunctionExecutor<PlannerAgent> {
  constructor(private readonly model: Model, private readonly openAiWrapperService: OpenaiWrapperService, private readonly memberId, private  readonly aiFunctionExecutor: AiFunctionExecutor<any>) {}
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
    const inferenceSSESubject = new InferenceSSESubject();
    // const aiFunctionExecutor = new CalculatorTools();
    const aiFunctionContext = new PlannerAgentFunctionContext(inferenceSSESubject, this);

    let completeText = '';
    const result = await this.openAiWrapperService.callOpenAiUsingModelAndSubject({
      openAiMessages: [
          { role: 'system', content: getToolsPrompt()},
          { role: 'system', content: this.getCreatePlanPrompt(userPrompt)}
      ],
      handleOnText: (text)=> {
        completeText += text;
      },
      abortController, inferenceSSESubject, model: this.model, memberId: this.memberId, tools: this.getToolsMetadata(),
      toolService: this,
      aiFunctionContext,
    });
    // console.log(`plannerAgent completeText streamed: `, completeText);
    result.completeText = completeText;
    return {...result, agentPlan: this.agentPlan};
  }

  //Test Summary: 9/30   30.00%
  getCreatePlanPrompt(userPrompt: string){
    return `
# Planning Agent Instructions

## Your Role
You are a Planning Agent whose ONLY responsibility is to create a structured plan of tool calls to address the user's prompt. Another agent will execute your plan, so focus exclusively on planning, not execution.

## Expected Process (Follow This Exactly)
1. Analyze the user prompt carefully
2. Identify required tools from those provided to you
3. Create a sequential plan using ONLY the provided planning tools:
   - First call: \`aiCreatePlan\` (always first)
   - Middle calls: \`aiAddFunctionStepToPlan\` (one or more steps)
   - Last call: \`aiCompletePlan\` (always last)
4. Make ALL tool calls in a SINGLE response (do not wait for results between calls)
5. After receiving \`{success: true}\` from \`aiCompletePlan\`, respond only with a blank space. e.g. ' '  This is extremely important.

## Critical Rules
- Call ONLY the planning tools (aiCreatePlan, aiAddFunctionStepToPlan, aiCompletePlan)
- Reference other provided tools ONLY as steps in your plan
- NEVER invent tools that weren't provided to you
- Make ALL tool calls in ONE response
- Use parameter referencing syntax \`$functionName.result\` for dependencies
- ALWAYS end your plan with aiCompletePlan
- NO explanatory text, preambles, or dialogue - ONLY tool calls
- Format all tool calls as proper JSON objects

## Tool Call JSON Format
Format each tool call as a JSON object with "name" and "arguments" fields:

\`\`\`
  {"name": "toolName", "arguments": {parameterName: parameterValue, ...}}
\`\`\`

Example:
\`\`\`
  {"name": "aiCreatePlan", "arguments": {"id": "my_plan_id"}}
\`\`\`

## Parameter Referencing Syntax
When a step depends on a previous step's result, use this to indicate the entire result: \`$functionName.result\`
Do not guess or make up any property names. 

## Chain-of-Thought Process
1. First, identify what the user is asking for
2. Break down the necessary steps to achieve this goal
3. Map each step to an appropriate tool
4. Check dependencies between steps
5. Ensure all steps are necessary and sufficient
6. Create a complete plan with proper sequencing
7. Format every tool call as a proper JSON object

# Example Scenarios with JSON-Formatted Responses

## SUCCESSFUL EXAMPLE 1: Web Search and Summarize
**User prompt**: "Find the latest news about climate change and summarize it for me."

**Successful Response**:
Note: there is a blank space after aiCompletePlan
\`\`\`
    {"name": "aiCreatePlan", "arguments": {"id": "climate_news_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "searchWeb", "functionArgs": {"query": "latest climate change news"}, "reasonToAddStep": "Need to gather recent information on climate change."}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "summarize", "functionArgs": {"textToSummarize": "$searchWeb.result"}, "reasonToAddStep": "Need to condense the search results into a readable summary."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to search for and summarize climate change news as requested."}} 
\`\`\`

## SUCCESSFUL EXAMPLE 2: Multi-Step Calculation
Note: there is a blank space after aiCompletePlan
**User prompt**: "Convert 100 USD to EUR, then calculate 15% of that amount."

**Successful Response**:
\`\`\`
    {"name": "aiCreatePlan", "arguments": {"id": "currency_calculation_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "currencyConvert", "functionArgs": {"amount": 100, "from": "USD", "to": "EUR"}, "reasonToAddStep": "Need to convert USD to EUR as requested."}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "calculatePercentage", "functionArgs": {"value": "$currencyConvert.result", "percentage": 15}, "reasonToAddStep": "Need to calculate 15% of the converted amount."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to convert currency and calculate percentage as requested."}}
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
    {"name": "aiCreatePlan", "arguments": {"id": "paris_weather_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "getWeather", "functionArgs": {"location": "Paris"}, "reasonToAddStep": "Need to retrieve current weather data for Paris."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides step to get weather information for Paris as requested."}} 
\`\`\`

## UNSUCCESSFUL EXAMPLE 2: Multiple Responses Instead of One
**User prompt**: "Create a shopping list with 5 items and calculate the total cost."

**Problematic Response**:
First response:
\`\`\`
    {"name": "aiCreatePlan", "arguments": {"id": "shopping_list_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "createShoppingList", "functionArgs": {"numItems": 5}, "reasonToAddStep": "Need to create a shopping list with 5 items."}}
\`\`\`
Then in a second response:
\`\`\`
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "calculateTotalCost", "functionArgs": {"itemsList": "$createShoppingList.result"}, "reasonToAddStep": "Need to calculate the total cost of the shopping list."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to create a shopping list and calculate total cost."}}
\`\`\`

**Why it fails**: The LLM split the tool calls across multiple responses instead of including all in one response.

**Corrected Response**:
\`\`\`
    {"name": "aiCreatePlan", "arguments": {"id": "shopping_list_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "createShoppingList", "functionArgs": {"numItems": 5}, "reasonToAddStep": "Need to create a shopping list with 5 items."}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "calculateTotalCost", "functionArgs": {"itemsList": "$createShoppingList.result"}, "reasonToAddStep": "Need to calculate the total cost of the shopping list."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to create a shopping list and calculate total cost."}}
\`\`\`

## UNSUCCESSFUL EXAMPLE 3: Inventing Tools
**User prompt**: "Write an email to my boss asking for a day off."

**Problematic Response**:
\`\`\`
    {"name": "aiCreatePlan", "arguments": {"id": "email_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "generateEmail", "functionArgs": {"recipient": "boss", "subject": "Request for Day Off", "purpose": "day off request"}, "reasonToAddStep": "Need to draft an email requesting time off."}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "sendEmail", "functionArgs": {"emailContent": "$generateEmail.result"}, "reasonToAddStep": "Need to send the generated email."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides steps to create and send an email requesting time off."}}
\`\`\`

**Why it fails**: The LLM invented tools that weren't provided (generateEmail, sendEmail).

**Corrected Response (assuming textGeneration is an available tool)**:
\`\`\`
    {"name": "aiCreatePlan", "arguments": {"id": "email_plan"}}
    {"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "textGeneration", "functionArgs": {"prompt": "Write a professional email to my boss requesting a day off", "style": "formal"}, "reasonToAddStep": "Need to draft an email requesting time off."}}
    {"name": "aiCompletePlan", "arguments": {"completedReason": "Plan provides step to generate email content for a day off request."}}
\`\`\`

## User Prompt
<prompt>${userPrompt}</prompt>

Remember: You MUST call all tools (aiCreatePlan → aiAddFunctionStepToPlan → aiCompletePlan) in ONE response, formatted as JSON objects. Do not use preamble in your response. Do not respond with anything other than tool calls. If you were not sent appropriate tools, do not respond at all.

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

    const functionStep = new AiFunctionStep(id, functionName, functionArgs, reasonToAddStep);
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
