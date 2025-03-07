import {Test, TestingModule} from "@nestjs/testing";
import {ModelsService} from "../services/models.service";
import {ModelsRepository} from "../repositories/models.repository";
import { OpenaiWrapperService } from '../services/openaiWrapper.service';
import PlannerAgentV3 from '../models/agent/PlannerAgentV3';
import { Model } from '../models/api/conversationApiModels';
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import ToolCall = ChatCompletionChunk.Choice.Delta.ToolCall;
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import InferenceSSESubject from '../models/InferenceSSESubject';
import { getChatPageSystemPrompt } from '../utils/prompts';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { AiFunctionContextV2 } from '../models/agent/aiTypes';

describe('Agent Tests', () => {
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

  describe('Planner Agent V3', ()=>{
    let successCounts: Record<string, number> = {};
    let failureCounts: Record<string, number> = {};
    let totalFails = 0;
    let totalSuccesses = 0;
    const trackResult = (key: string, passed: boolean) => {
      if (passed) {
        ++totalSuccesses;
        successCounts[key] = (successCounts[key] || 0) + 1;
      } else {
        ++totalFails;
        failureCounts[key] = (failureCounts[key] || 0) + 1;
      }
    };
    const trackFailure = (key: string) => trackResult(key, false);
    const trackSuccess = (key: string) => trackResult(key, true);

    async function withTracking(key: string, func: () => Promise<void>){
      try{
        await func();
        trackSuccess(key);
      }catch(e){
        trackFailure(key);
      }
    }

    function expectTrueWithTracking(key: string, value: boolean){
      try{
        expect(value).toBe(true);
        trackSuccess(key);
      }catch(e){
        trackFailure(key);
      }
    }

    beforeEach(()=>{
      successCounts = {};
      failureCounts = {};
      totalFails = 0;
    })

    //100% success with 100 iterations.
    it('It should create plans without hallucinating function names', async () => {
      const openAiWrapperService = testingModule.get<OpenaiWrapperServiceV2>(OpenaiWrapperServiceV2);
      const memberId = "1";
      const calculatorTools = testingModule.get<CalculatorToolsService>(CalculatorToolsService);

      async function askPlannerBot(prompt: string){
        const originalOpenAiMessages: ChatCompletionMessageParam[] = [
          {role: 'system', content: `
        You are a general purpose assistant that responds to user requests.
        Additionally, you have been provided with tools/functions that you can potentially use to respond to a user request.  
        If no tools are applicable, simply respond as you normally would to any other request.
        For example, if the user asks you who George Washington is, and there isn't a webSearch or biography tool, you would simply respond with information you know about George Washington.
        `},
        ];

        const plannerAgent = new PlannerAgentV3(model, openAiWrapperService, memberId, calculatorTools, undefined, originalOpenAiMessages);
        return await plannerAgent.createPlan(prompt);
      }


      const iterations = 30;

      for(let i = 0; i < iterations; ++i){
        const r1 = await askPlannerBot( "Add 5 to 5, then subtract 1, and divide by 3, then multiply by 2.");
        try{
          expectTrueWithTracking('known functions doFunctionsExistToFulfillTheUserRequest', r1.agentPlan.doFunctionsExistToFulfillTheUserRequest == true);
          expectTrueWithTracking('known functions functionSteps length', r1.agentPlan.functionSteps.length == 4);
          expectTrueWithTracking('known functions total openai calls', r1.totalOpenAiCallsMade == 2);
        }catch(e){
          console.error(e);
          expectTrueWithTracking(`LLM error: ${e.message}`, false);
        }

        const r2 = await askPlannerBot( "Search the web for bitcoin news, then send a summary email to Bob@gmail.com");
        try{
          expectTrueWithTracking('unknown functions doFunctionsExistToFulfillTheUserRequest', r2.agentPlan.doFunctionsExistToFulfillTheUserRequest == false);
          expectTrueWithTracking('unknown functions functionSteps length', r2.agentPlan.functionSteps.length == 0);
          expectTrueWithTracking('unknown functions total openai calls', r2.totalOpenAiCallsMade == 2);
        }catch(e){
          console.error(e);
          expectTrueWithTracking(`LLM error: ${e.message}`, false);
        }


        const r3 = await askPlannerBot( "Send bob a message asking whether he wants to eat at Olive Garden for lunch.  Also, add 7 + 7, then divide the result by 3.");
        try{
          expectTrueWithTracking('both functions doFunctionsExistToFulfillTheUserRequest', r3.agentPlan.doFunctionsExistToFulfillTheUserRequest == true);
          expectTrueWithTracking('both functions functionSteps length', r3.agentPlan.functionSteps.length == 2);
          expectTrueWithTracking('both functions total openai calls', r3.totalOpenAiCallsMade == 2);
        }catch(e){
          console.error(e);
          expectTrueWithTracking(`LLM error: ${e.message}`, false);
        }

      }

      //success
      //{
      //   "known functions doFunctionsExistToFulfillTheUserRequest": 29,
      //   "known functions functionSteps length": 29,
      //   "known functions total openai calls": 21,
      //   "unknown functions doFunctionsExistToFulfillTheUserRequest": 22,
      //   "both functions doFunctionsExistToFulfillTheUserRequest": 29,
      //   "both functions functionSteps length": 17,
      //   "unknown functions total openai calls": 13,
      //   "both functions total openai calls": 2
      // }
      //failure
      //{
      //   "unknown functions functionSteps length": 29,
      //   "unknown functions total openai calls": 16,
      //   "both functions total openai calls": 28,
      //   "both functions functionSteps length": 13,
      //   "known functions total openai calls": 8,
      //   "unknown functions doFunctionsExistToFulfillTheUserRequest": 7,
      //   "both functions doFunctionsExistToFulfillTheUserRequest": 1,
      //   "LLM error: Cannot read properties of undefined (reading 'doFunctionsExistToFulfillTheUserRequest')": 2
      // }
      const successRate = totalSuccesses / (totalSuccesses + totalFails);
      expect(successRate >= 0.7).toBe(true);
    }, 15 * 60 * 1000);

  });
});

function getMessageByRole(role: string, openAiMessages: ChatCompletionMessageParam[]){
  return openAiMessages.filter(m => m.role === role);
}
