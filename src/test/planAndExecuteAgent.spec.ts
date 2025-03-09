import { AiFunctionContextV2, AiFunctionExecutor, AiFunctionResult } from '../models/agent/aiTypes';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, SearchResultWithMarkdownContentResponse } from '../models/api/conversationApiModels';
import { PlanAndExecuteAgent } from '../models/agent/PlanAndExecuteAgent';
import InferenceSSESubject from '../models/InferenceSSESubject';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { getChatPageSystemPrompt } from '../utils/prompts';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { WebToolsService } from '../services/agent/tools/webTools.service';
import { DuckduckgoSearchService } from '../services/duckduckgoSearch.service';
import { PageScraperService } from '../services/pageScraper.service';
import { chatCompletionTool, extractChatCompletionToolAnnotationValues } from '../services/agent/tools/aiToolAnnotations';

describe('Plan and Execute agent', () => {
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
      providers: [OpenaiWrapperServiceV2, CalculatorToolsService, WebToolsService, DuckduckgoSearchService, PageScraperService],
    }).compile();
  });

  it('should acknowledge what tools are available', async ()=>{
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    class NoToolsService implements AiFunctionExecutor<NoToolsService> {
      getToolsMetadata(): ChatCompletionTool[] {
        return [];
      }
    }
    const noToolsService = new NoToolsService();
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, noToolsService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()}
    ];

    async function askNoToolsPlannerBot(mathQuestion: string){
      const result = await planAndExecuteAgent.planAndExecuteThenStreamResultsBack(mathQuestion, originalOpenAiMessages, true);
      return result;
    }

    async function askNoToolsLlm(question: string){
      const result = await openAiWrapperService.callOpenAiUsingModelAndSubject({
        openAiMessages: [...originalOpenAiMessages, {role: 'user', content: question}],
        model,
        aiFunctionContext: {
          inferenceSSESubject,
          aiFunctionExecutor:noToolsService,
          functionResultsStorage: {},
          memberId,
          abortController,
        },
        totalOpenAiCallsMade: 0,
      });
      return result;
    }

    const result = await askNoToolsLlm('What tools are available to you?');
    expect(result.completeText.length > 0).toBe(true);


    // const result2 = await askNoToolsPlannerBot("What is the capital of France?");
    // expect(result2.planFinalResult).toBe(undefined);
  });

  it('should create and execute a plan with no tools', async ()=>{
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    class NoToolsService implements AiFunctionExecutor<NoToolsService> {
      getToolsMetadata(): ChatCompletionTool[] {
        return [];
      }
    }
    const noToolsService = new NoToolsService();
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, noToolsService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()}
    ];

    async function askNoToolsBot(mathQuestion: string){
      const result = await planAndExecuteAgent.planAndExecuteThenStreamResultsBack(mathQuestion, originalOpenAiMessages, true);
      return result;
    }

    const result1 = await askNoToolsBot("compute 3 raised to the power of 4, then add 10");
    expect(result1.planFinalResult).toBe(undefined);

    const result2 = await askNoToolsBot("Call my dentist and schedule an appointment for the 5th of May, then text my Mom hello");
    expect(result2.planFinalResult).toBe(undefined);
  });

  it('should create and execute a plan that returns correct calculations.', async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const calculatorToolsService = testingModule.get<CalculatorToolsService>(CalculatorToolsService);
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, calculatorToolsService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()}
    ]

    async function askMathBot(mathQuestion: string){
      const result = await planAndExecuteAgent.planAndExecuteThenStreamResultsBack(mathQuestion, originalOpenAiMessages, true);
      return result;
    }

    const result2 = await askMathBot("compute 3 raised to the power of 4, then add 10");
    expect(result2.planFinalResult).toBe(91); // 3^4 = 81, then 81 + 10 = 91

    const result3 = await askMathBot("take 17 modulo 5, then multiply the result by 4");
    expect(result3.planFinalResult).toBe(8); // 17 mod 5 = 2, then 2 * 4 = 8

    const result4 = await askMathBot("find the square root of 81, then subtract 3");
    expect(result4.planFinalResult).toBe(6); // sqrt(81) = 9, then 9 - 3 = 6

    const result5 = await askMathBot("compute 5 factorial, then divide by 10");
    expect(result5.planFinalResult).toBe(12); // 5! = 120, then 120 / 10 = 12

    const result6 = await askMathBot("raise 2 to the power of 5 and then take the result modulo 7");
    expect(result6.planFinalResult).toBe(4); // 2^5 = 32, then 32 mod 7 = 4

    const result7 = await askMathBot("calculate the factorial of 3 and then raise the result to the power of 2");
    expect(result7.planFinalResult).toBe(36); // 3! = 6, then 6^2 = 36

    const result8 = await askMathBot("compute 4 factorial, then raise it to the power of 2, then take the result modulo 50");
    expect(result8.planFinalResult).toBe(26); // 4! = 24, then 24^2 = 576, and 576 mod 50 = 26

    //it messes up this one and computes the square root of 144, then computes the factorial of 3, but doesn't call add function, so it ends up returning 6 (3!)
    const result9 = await askMathBot("compute the square root of 144, then add to that result the factorial of 3");
    expect(result9.planFinalResult).toBe(18); // sqrt(144) = 12 and 3! = 6, so 12 + 6 = 18

    const result10 = await askMathBot("compute the factorial of 4, then from that result subtract the square root of 64, then add to the result 3 raised to the power of 3, and finally take the result modulo 10");
    expect(result10.planFinalResult).toBe(3);

    const result11 = await askMathBot("add 5 + 5, then subtract 13, then multiply by 2.");
    expect(result11.planFinalResult).toBe(-6);

    const result12 = await askMathBot("What is 12 factorial?");
    expect(result12.planFinalResult).toBe(479001600);

    const result13 = await askMathBot("What do you get when you subtract 100 from the factorial of the square root of 144?");
    expect(result13.planFinalResult).toBe(479001500);

    const result14 = await askMathBot('what is 10 mod 4?');
    expect(result14.planFinalResult).toBe(2);

  }, 5 * 60 * 1000);


  it('should create and execute a plan that searches the web and summarizes.', async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const webToolsService = testingModule.get<WebToolsService>(WebToolsService);
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, webToolsService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()}
    ]

    async function askWebBot(webQuestion: string){
      const result = await planAndExecuteAgent.planAndExecuteThenStreamResultsBack(webQuestion, originalOpenAiMessages, true);
      return result;
    }

    const iterations = 20;
    for(let i = 0; i < iterations; ++i){
      const result2 = await askWebBot("search the web for latest news headlines and summarize them.");
      expect(result2.planFinalResult instanceof SearchResultWithMarkdownContentResponse).toBe(true); // 3^4 = 81, then 81 + 10 = 91
      expect(result2.finalResponseFromLLM.length > 0).toBe(true);
    }

  }, 5 * 60 * 1000);

  it('should avoid creating and executing a plan when no tools are provided, but still stream result.', async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    const webToolsService = undefined;
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, webToolsService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()}
    ]

    async function askWebBot(webQuestion: string){
      const result = await planAndExecuteAgent.planAndExecuteThenStreamResultsBack(webQuestion, originalOpenAiMessages, true);
      return result;
    }

    const result2 = await askWebBot("What is the capital of France?");
    expect(result2.finalResponseFromLLM.length > 0).toBe(true);

  });


  it('should handle tool errors', async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
    class ErrorToolService implements AiFunctionExecutor<ErrorToolService> {

      @chatCompletionTool({
        type: "function",
        function: {
          name: "aiAdd",
          description: "Add two numbers and return the sum.",
          parameters: {
            type: "object",
            properties: {
              a: {
                type: "number",
                description: "The first number.",
              },
              b: {
                type: "number",
                description: "The second number.",
              },
            },
            required: ["a", "b"],
          },
        }
      })
      async aiAdd({ a, b }: { a: number; b: number }, context: AiFunctionContextV2): Promise<AiFunctionResult> {
        throw new Error("Calculation misfired!");
        return {result: a + b, context};
      }

      @chatCompletionTool({
        type: "function",
        function: {
          name: "aiGetStateCapital",
          description: "Get the capital of a state",
          parameters: {
            type: "object",
            properties: {
              state: {
                type: "string",
                description: "The state to get a capital for",
              },
            },
            required: ["state"],
          },
        }
      })
      async aiGetStateCapital({ state}: { state: string }, context: AiFunctionContextV2): Promise<AiFunctionResult> {

        return {result: "Paris", context};
      }

      getToolsMetadata(): ChatCompletionTool[] {
        return extractChatCompletionToolAnnotationValues(this);
      }
    }

    const errorToolService = new ErrorToolService();
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, errorToolService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()},
    ]

    async function askAgent(webQuestion: string){
      const result = await planAndExecuteAgent.planAndExecuteThenStreamResultsBack(webQuestion, originalOpenAiMessages, true);
      return result;
    }

    const iterations = 1;
    for(let i = 0; i < iterations; ++i){
      // const result2 = await askAgent("add 490,234,352,643 + 5,000,000,325,235");
      // expect(result2.planFinalResult instanceof Error).toBe(true);
      // expect(result2.finalResponseFromLLM.length > 0).toBe(true);
      //
      // const result3 = await askAgent("What is the capital of Utah? What is 9 + 7?");
      // expect(result3.planFinalResult instanceof Error).toBe(true);
      // expect(result3.finalResponseFromLLM.length > 0).toBe(true);
      //
      // const result4 = await askAgent("What is the capital of Utah? Send an email to bob@gmail.com with the result.");
      // expect(result4.planFinalResult instanceof Error).toBe(true);
      // expect(result4.finalResponseFromLLM.length > 0).toBe(true);

      const result5 = await askAgent("Search the web for fun facts about cats.  Send an email to john@gmail.com with the cat info.  Also, what is the capital of Utah?");
      expect(result5.finalResponseFromLLM.length > 0).toBe(true);
    }

  }, 5 * 60 * 1000);
});


