import { Test, TestingModule } from '@nestjs/testing';
import { Model } from '../models/api/conversationApiModels';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { toolCallEndMarker, toolCallStartMarker } from '../utils/prompts';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiFunctionContext, AiFunctionContextV2, AiFunctionExecutor } from '../models/agent/aiTypes';
import InferenceSSESubject from '../models/InferenceSSESubject';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';

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
        Additionally, you have been provided with tools/functions that you can potentially use to respond to a user request.  
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

    // const result3 = await askBot("send an email to bob@gmail.com with subject: hi bob!");
    // expect(result3.completeText !== undefined).toBe(true);

    const result4 = await askBot("what is 2 + 2, then take the result and divide by 3?");
    expect(result4.completeText !== undefined).toBe(true);

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
});
