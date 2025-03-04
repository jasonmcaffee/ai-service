import { AgentPlan, AiFunctionStep } from '../models/agent/AgentPlan';
import { AiFunctionContext, AiFunctionExecutor } from '../models/agent/aiTypes';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import { PlanExecutor } from '../models/agent/PlanExecutor';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from '../models/api/conversationApiModels';
import { OpenaiWrapperService } from '../services/openaiWrapper.service';
import { PlanAndExecuteAgent } from '../models/agent/PlanAndExecuteAgent';
import InferenceSSESubject from '../models/InferenceSSESubject';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getChatPageSystemPrompt } from '../utils/prompts';

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
      providers: [OpenaiWrapperService, CalculatorToolsService],
    }).compile();
  });

  it('should create and execute a plan with no tools', async ()=>{

  });

  it('should create and execute a plan that returns correct calculations.', async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperService>(OpenaiWrapperService);
    const calculatorToolsService = testingModule.get<CalculatorToolsService>(CalculatorToolsService);
    const inferenceSSESubject = new InferenceSSESubject();
    const memberId = "1";
    const abortController = new AbortController();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, calculatorToolsService, inferenceSSESubject, abortController);

    const originalOpenAiMessages: ChatCompletionMessageParam[] = [
      {role: 'system', content: getChatPageSystemPrompt()}
    ]

    async function askMathBot(mathQuestion: string){
      const result = await planAndExecuteAgent.createAndExecutePlanUsingTools(mathQuestion, originalOpenAiMessages);
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
});
