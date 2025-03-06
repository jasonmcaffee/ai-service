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

      //works
      const r1 = await askPlannerBot( "Add 5 to 5, then subtract 1, and divide by 3, then multiply by 2.");
      expect(r1.completeText == "complete").toBe(true);
      expect(r1.agentPlan.doFunctionsExistToFulfillTheUserRequest).toBe(true);
      expect(r1.agentPlan.functionSteps.length).toBe(4); //add, subtract, divide, multiply.
      //
      // //doesn't hallucinates functionNames
      const r2 = await askPlannerBot( "Search the web for bitcoin news, then send a summary email to Bob@gmail.com");
      expect(r2.completeText == "complete").toBe(true);
      expect(r2.agentPlan.doFunctionsExistToFulfillTheUserRequest).toBe(false);
      expect(r2.agentPlan.functionSteps.length).toBe(0);

      //this sometimes hallucinates aiSendEmail
      const r3 = await askPlannerBot( "Send bob a message asking whether he wants to eat at Olive Garden for lunch.  Also, add 7 + 7, then divide the result by 3.");
      expect(r3.completeText == "complete").toBe(true);
      expect(r3.agentPlan.doFunctionsExistToFulfillTheUserRequest).toBe(true);
      expect(r3.agentPlan.functionSteps.length).toBe(2);
    }, 15 * 60 * 1000);

  });
});

function getMessageByRole(role: string, openAiMessages: ChatCompletionMessageParam[]){
  return openAiMessages.filter(m => m.role === role);
}
