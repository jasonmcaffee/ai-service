import {Test, TestingModule} from "@nestjs/testing";
import {ModelsService} from "../services/models.service";
import {ModelsRepository} from "../repositories/models.repository";
import { OpenaiWrapperService } from '../services/openaiWrapper.service';
import PlannerAgentV2 from '../models/agent/PlannerAgentV2';
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

  describe('Planner Agent V2', ()=>{
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

        const plannerAgent = new PlannerAgentV2(model, openAiWrapperService, memberId, calculatorTools, undefined, originalOpenAiMessages);
        return await plannerAgent.createPlan(prompt);
      }


      const iterations = 10;

      for(let i = 0; i < iterations; ++i){
        const r1 = await askPlannerBot( "Add 5 to 5, then subtract 1, and divide by 3, then multiply by 2.");

        expectTrueWithTracking('known functions doFunctionsExistToFulfillTheUserRequest', r1.agentPlan.doFunctionsExistToFulfillTheUserRequest == true);
        expectTrueWithTracking('known functions functionSteps length', r1.agentPlan.functionSteps.length == 4);

        const r2 = await askPlannerBot( "Search the web for bitcoin news, then send a summary email to Bob@gmail.com");
        expectTrueWithTracking('unknown functions doFunctionsExistToFulfillTheUserRequest', r2.agentPlan.doFunctionsExistToFulfillTheUserRequest == false);
        expectTrueWithTracking('unknown functions functionSteps length', r2.agentPlan.functionSteps.length == 0);

        const r3 = await askPlannerBot( "Send bob a message asking whether he wants to eat at Olive Garden for lunch.  Also, add 7 + 7, then divide the result by 3.");
        expectTrueWithTracking('both functions doFunctionsExistToFulfillTheUserRequest', r3.agentPlan.doFunctionsExistToFulfillTheUserRequest == true);
        expectTrueWithTracking('both functions functionSteps length', r3.agentPlan.functionSteps.length == 2);

      }

      //success with 10
      //{
      //   "known functions doFunctionsExistToFulfillTheUserRequest": 8,
      //   "known functions functionSteps length": 10,

      //   "unknown functions doFunctionsExistToFulfillTheUserRequest": 6,
      //   "unknown functions functionSteps length": 8,

      //   "both functions doFunctionsExistToFulfillTheUserRequest": 2
      //   "both functions functionSteps length": 10,
      // }

      //success rate 0.9. with 10
      //{ success
      //   "known functions doFunctionsExistToFulfillTheUserRequest": 10,
      //   "known functions functionSteps length": 10,

      //   "unknown functions doFunctionsExistToFulfillTheUserRequest": 8,
      //   "unknown functions functionSteps length": 9,

      //   "both functions doFunctionsExistToFulfillTheUserRequest": 6,
      //   "both functions functionSteps length": 8
      // }

      //20 iterattion success
      //{
      //   "known functions completeText": 20,
      //   "known functions doFunctionsExistToFulfillTheUserRequest": 20,
      //   "known functions functionSteps length": 20,
      //   "unknown functions completeText": 20,
      //   "unknown functions doFunctionsExistToFulfillTheUserRequest": 15,
      //   "unknown functions functionSteps length": 17,
      //   "both functions completeText": 20,
      //   "both functions doFunctionsExistToFulfillTheUserRequest": 15,
      //   "both functions functionSteps length": 13
      // }
      const successRate = totalSuccesses / (totalSuccesses + totalFails);
      expect(successRate > 0.8).toBe(true);
    }, 15 * 60 * 1000);

  });
});

function getMessageByRole(role: string, openAiMessages: ChatCompletionMessageParam[]){
  return openAiMessages.filter(m => m.role === role);
}
