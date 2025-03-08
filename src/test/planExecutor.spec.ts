import { AgentPlan, AiFunctionStep } from '../models/agent/AgentPlan';
import { AiFunctionContext, AiFunctionContextV2, AiFunctionExecutor } from '../models/agent/aiTypes';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import { PlanExecutor } from '../models/agent/PlanExecutor';

describe('Executor Tests', () => {
  it('should execute a plan', async ()=> {
    const agentPlan = new AgentPlan("1");
    const functionStep1 = new AiFunctionStep("1", "aiAdd", {a: 1, b: 2}, "test");
    const functionStep2 = new AiFunctionStep("2", "aiSubtract", {a: "$aiAdd.result", b: 1}, "test");
    agentPlan.functionSteps = [functionStep1, functionStep2];

    const aiFunctionExecutor: AiFunctionExecutor<CalculatorToolsService> = new CalculatorToolsService();
    const aiFunctionContext: AiFunctionContextV2 = {aiFunctionExecutor, functionResultsStorage: {}, memberId: "1"};

    const planExecutor = new PlanExecutor(agentPlan, aiFunctionContext);

    await planExecutor.executePlan();

    expect(aiFunctionContext.functionResultsStorage["$aiAdd.result"]).toBe(3);
    expect(aiFunctionContext.functionResultsStorage["$aiSubtract.result"]).toBe(2);

  });
});
