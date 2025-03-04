import { AgentPlan, AiFunctionStep } from '../models/agent/AgentPlan';
import { AiFunctionContext, AiFunctionExecutor } from '../models/agent/aiTypes';
import { CalculatorTools } from '../models/agent/CalculatorTools';
import { PlanExecutor } from '../models/agent/PlanExecutor';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from '../models/api/conversationApiModels';
import { OpenaiWrapperService } from '../services/openaiWrapper.service';
import { PlanAndExecuteAgent } from '../models/agent/PlanAndExecuteAgent';

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
      providers: [OpenaiWrapperService],
    }).compile();
  });

  it('should create and execute a plan', async ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperService>(OpenaiWrapperService);
    const memberId = "1";

    const calculatorTools = new CalculatorTools();
    const planAndExecuteAgent = new PlanAndExecuteAgent(model, openAiWrapperService, memberId, calculatorTools);

    const result = await planAndExecuteAgent.createAndExecutePlanUsingTools("add 5 + 5, then subtract 13, then multiply by 2.");
    expect(result).toBe(-6);


  });
});
