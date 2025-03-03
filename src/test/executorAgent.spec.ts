import { AgentPlan, AiFunctionStep } from '../models/agent/AgentPlan';

describe('Executor Tests', () => {
  it('should execute a plan', ()=> {
    const agentPlan = new AgentPlan("1");
    const functionStep1 = new AiFunctionStep("1", "aiAdd", {a: 1, b: 2}, "test");
    const functionStep2 = new AiFunctionStep("2", "aiSubtract", {a: "$aiAdd.result", b: 3}, "test");
    agentPlan.functionSteps = [functionStep1, functionStep2];


  });
});
