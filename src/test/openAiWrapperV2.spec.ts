import { Test, TestingModule } from '@nestjs/testing';
import { Model } from '../models/api/conversationApiModels';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { toolCallEndMarker, toolCallStartMarker } from '../utils/prompts';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiFunctionContext, AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult } from '../models/agent/aiTypes';
import InferenceSSESubject from '../models/InferenceSSESubject';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import PlannerAgentV2 from '../models/agent/PlannerAgentV2';
import { chatCompletionTool, extractChatCompletionToolAnnotationValues } from '../services/agent/tools/aiToolAnnotations';

describe("parseLlamaCppToolCalls", ()=>{
  let testingModule: TestingModule;
  const model = new Model();
  model.id = 'testing model';
  model.initialMessage = '';
  model.url = 'http://192.168.0.209:8080';
  model.displayName = 'testing';
  model.isDefault = true;
  model.apiKey = '';
  model.modelName = '';


  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [OpenaiWrapperServiceV2, CalculatorToolsService],
    }).compile();
  });


  it("should support non streamed questions with calculator tools using reference syntax .", async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const memberId = "1";
    const calculatorTools = testingModule.get<CalculatorToolsService>(CalculatorToolsService);


    const aiFunctionContext: AiFunctionContextV2 = {
      inferenceSSESubject: new InferenceSSESubject(),
      memberId,
      aiFunctionExecutor: calculatorTools, //todo make optional
      functionResults: {},
      abortController: new AbortController(),
    }

    async function askBot(prompt: string){
      const openAiMessages: ChatCompletionMessageParam[] = [
        {role: 'system', content: `
        You are a general purpose assistant that responds to user requests.
        Additionally, you have been provided with tools/functions that you can potentially use to respond to a user request.  
        Multiple tool calls should be made in a single response from you.
        Use parameter referencing syntax \`$functionName.result\` for dependencies between tool calls.
        e.g. if tool aiAdd needs the result from previous response from aiSubtract, then aiAdd parameter "a" value should be "$aiSubtract.result".
        
        Only respond using the result of the tool call.  Do not use any other knowledge outside of the tool call.
        
        If no tools are applicable, simply respond as you normally would to any other request.
        For example, if the user asks you who George Washington is, and there isn't a webSearch or biography tool, you would simply respond with information you know about George Washington.
        `},
        {role: 'user', content: prompt}
      ];
      return openAiWrapperService.callOpenAiUsingModelAndSubject({openAiMessages, aiFunctionContext, model, totalOpenAiCallsMade: 0});
    }

    const result4 = await askBot("call aiAdd with values 3 and 99");
    expect(result4.completeText !== undefined).toBe(true);

  });


  it("should support non streamed questions with calculator tools and not call tools when not needed.", async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const memberId = "1";
    const calculatorTools = testingModule.get<CalculatorToolsService>(CalculatorToolsService);


    const aiFunctionContext: AiFunctionContextV2 = {
      inferenceSSESubject: new InferenceSSESubject(),
      memberId,
      aiFunctionExecutor: calculatorTools, //todo make optional
      functionResults: {},
      abortController: new AbortController(),
    }

    async function askBot(prompt: string){
      const openAiMessages: ChatCompletionMessageParam[] = [
        {role: 'system', content: `
        You are a general purpose assistant that responds to user requests.
        
        # Tools (aka functions)
        Additionally, you have been provided with tools/functions that you can potentially use to respond to a user request.  
       
        ## Tool Usage
        Spend time deeply reasoning about the tools you have been provided, and be extremely careful not to attempt to use tools that haven't been explicitly defined.
        It is extremely important that you do not invent tools/functions, and it will cause a great deal of harm if you do.
         
        ## Tool Execution
        Follow these guidelines exactly:
        - All tool calls made by you should be done in ONE response.  ie. You should call all tools needed for a user prompt directly after a user prompt is received.
        - Since all tool calls must happen at once, when a tool call depends on the result of a previous tool call, use parameter referencing syntax \`$functionName.result\` for dependencies.
        
        ### Example of a good tool execution flow
        user prompt: "find the email address for member id 1, then send them a welcome email"
        your response: 2 tool calls in a single response.
          1. {name: "findEmail", params: { memberId: 1} }
          2. {name: "sendEmail", params: { email: "$findEmail.result", body: "Welcome!" }
        
        ### Example of a bad tool execution flow
        user prompt: "find the email address for member id 1, then send them a welcome email"
        your response: 1 tool call in the first response.
          1. {name: "findEmail", params: { memberId: 1} }
        client: sends result of findEmail back to you
        your response: 1 tool call in the second response  
          1. {name: "sendEmail", params: { email: "jack@gmail.com", body: "Welcome!" }
        
        # Final guidance
        If no tools are applicable, simply respond as you normally would to any other request.
        For example, if the user asks you who George Washington is, and there isn't a webSearch or biography tool, you would simply respond with information you know about George Washington.
        
        `},
        {role: 'user', content: prompt}
      ];
      return openAiWrapperService.callOpenAiUsingModelAndSubject({openAiMessages, aiFunctionContext, model, totalOpenAiCallsMade: 0});
    }

    // const result = await askBot("Where is Paris?")
    // expect(result.completeText !== undefined).toBe(true);

    // const result2 = await askBot("what is 2 + 2?");
    // expect(result2.completeText !== undefined).toBe(true);
    // //
    // const result3 = await askBot("send an email to bob@gmail.com with subject: hi bob!");
    // expect(result3.completeText !== undefined).toBe(true);

    // const r4 = await askBot('search the web for bitcoin news then send a summary email to bob@gmail.com');
    // expect(r4.completeText !== undefined).toBe(true);
    //

    // const result4 = await askBot("what is 2 + 2, then take the result and divide by 3?");
    // expect(result4.completeText !== undefined).toBe(true);

    // const result5 = await askBot("what is 2 + 2, then take the result and divide by 3, then send an email to bob@gmail.com with the result");
    // expect(result5.completeText !== undefined).toBe(true);

    // const result6 = await askBot("search the web for bitcoin news, then add 4 + 4, and subtract 9 from the result, and send that to john@gmail.com");
    // expect(result6.completeText !== undefined).toBe(true);

    const result7 = await askBot("search the database table users for last name 'Smith', then add 4 + 4, and subtract 9 from the result, and send that to john@gmail.com");
    expect(result7.completeText !== undefined).toBe(true);
  });

  it("should support non streamed questions with no tools", async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const memberId = "1";
    class NoToolsService implements AiFunctionExecutor<NoToolsService> {
      getToolsMetadata(): ChatCompletionTool[] {
        return [];
      }
    }
    const noToolsService = new NoToolsService();

    const openAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: 'you are a friendly assistant'},
      {role: 'user', content: 'Where is Paris?'}
    ];

    const aiFunctionContext: AiFunctionContextV2 = {
      inferenceSSESubject: new InferenceSSESubject(),
      memberId,
      aiFunctionExecutor: noToolsService, //todo make optional
      functionResults: {},
      abortController: new AbortController(),
    }

    const result = await openAiWrapperService.callOpenAiUsingModelAndSubject({openAiMessages, aiFunctionContext, model, totalOpenAiCallsMade: 0});
    console.log(`result: `, result);
    expect(result.completeText !== undefined).toBe(true);
  });


  it("should use values from tool calls.", async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const memberId = "1";
    class TestToolsService implements AiFunctionExecutor<TestToolsService> {
      getToolsMetadata(): ChatCompletionTool[] {
        const metadata = extractChatCompletionToolAnnotationValues(this);
        return metadata;
      }

      @chatCompletionTool({
        type: "function",
        function: {
          name: "aiSendMessageAndGetResponse",
          description: "send a message to a person and get a response back",
          parameters: {
            type: "object",
            properties: {
              personName: {
                type: "string",
                description: "Name of the person",
              },
              message: {
                type: "string",
                description: "The message to send to the person.",
              },
            },
            required: ["personName", "message"],
          },
        }
      })
      async aiSendMessageAndGetResponse({ personName, message }: { personName: string; message: string }, context: AiFunctionContextV2): Promise<AiFunctionResult> {
        return {result: `${personName} says hello from australia!`, context};
      }
    }
    const testToolsService = new TestToolsService();

    async function askBot(prompt: string){
      const openAiMessages: ChatCompletionMessageParam[] = [
        {role: 'system', content: `
        You are a general purpose assistant that responds to user requests.
        Additionally, you have been provided with tools/functions that you can potentially use to respond to a user request.  
        
        If no tools are applicable, simply respond as you normally would to any other request.
        For example, if the user asks you who George Washington is, and there isn't a webSearch or biography tool, you would simply respond with information you know about George Washington.
        `},
        {role: 'user', content: prompt}
      ];

      const aiFunctionContext: AiFunctionContextV2 = {
        inferenceSSESubject: new InferenceSSESubject(),
        memberId,
        aiFunctionExecutor: testToolsService, //todo make optional
        functionResults: {},
        abortController: new AbortController(),
      }

      return openAiWrapperService.callOpenAiUsingModelAndSubject({openAiMessages, aiFunctionContext, model, totalOpenAiCallsMade: 0});
    }
    const result = await askBot('send a message to Bob saying hey buddy, how are you?')
    expect(result.completeText !== undefined).toBe(true);
  });
});
