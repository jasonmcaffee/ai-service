import {Test, TestingModule} from "@nestjs/testing";
import {ModelsService} from "../services/models.service";
import {ModelsRepository} from "../repositories/models.repository";
import { OpenaiWrapperService } from '../services/openaiWrapper.service';
import PlannerAgent from '../models/agent/PlannerAgent';
import { Model } from '../models/api/conversationApiModels';
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import ToolCall = ChatCompletionChunk.Choice.Delta.ToolCall;

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
            providers: [OpenaiWrapperService],
        }).compile();
    });

    describe('Planner Agent', ()=>{

        //100% success with 100 iterations.
        it('It should consistently create plans', async () => {
            const openAiWrapperService = testingModule.get<OpenaiWrapperService>(OpenaiWrapperService);
            const memberId = "1";
            const iterations = 10;
            const successCounts: Record<string, number> = {};
            const failureCounts: Record<string, number> = {};

            const trackResult = (key: string, passed: boolean) => {
                if (passed) {
                    successCounts[key] = (successCounts[key] || 0) + 1;
                } else {
                    failureCounts[key] = (failureCounts[key] || 0) + 1;
                }
            };

            let totalSuccesses = 0;

            for (let i = 0; i < iterations; i++) {
                try {
                    const plannerAgent = new PlannerAgent(model, openAiWrapperService, memberId);
                    const { openAiMessages, completeText, totalOpenAiCallsMade } = await plannerAgent.createPlan(
                        "Add 5 to 5, then subtract 1, and divide by 3, then multiply by 2."
                    );

                    // console.log(`Iteration ${i + 1} - openAiMessages: `, JSON.stringify(openAiMessages, null, 2));
                    console.log(`Iteration ${i + 1} `);

                    try{
                        expect(plannerAgent.agentPlan.functionSteps.length).toBe(4);
                        trackResult("plannerAgentSteps", true);
                    }catch {
                        trackResult("plannerAgentSteps", false);
                        continue;
                    }

                    try {
                        expect(totalOpenAiCallsMade).toBe(2);
                        trackResult("totalOpenAiCallsMade", true);
                    } catch {
                        trackResult("totalOpenAiCallsMade", false);
                        continue;
                    }

                    const assistantMessages = getMessageByRole('assistant', openAiMessages);
                    try {
                        expect(assistantMessages.length === 1).toBe(true);
                        trackResult("assistantMessages.length", true);
                    } catch {
                        trackResult("assistantMessages.length", false);
                        continue;
                    }

                    //@ts-ignore
                    const assistantToolCalls = assistantMessages[0]?.tool_calls as ToolCall[] || [];
                    try {
                        expect(assistantToolCalls.length).toBe(6);
                        trackResult("assistantToolCalls.length", true);
                    } catch {
                        trackResult("assistantToolCalls.length", false);
                        continue;
                    }



                    try{
                        const [aiCreatePlanCall, aiAddFunctionStepAddCall, aiAddFunctionStepSubtractCall, aiAddFunctionStepDivideCall, aiAddFunctionStep, aiCompletePlanCall] = assistantToolCalls;
                        expect(aiCreatePlanCall.function?.name).toBe("aiCreatePlan");
                        expect(aiCompletePlanCall.function?.name).toBe("aiCompletePlan");
                        trackResult("assistantToolCalls create and complete in right spot", true);
                    }catch{
                        trackResult("assistantToolCalls create and complete in right spot", false);
                        continue;
                    }

                    try{
                        const [add, subtract, divide, multiply] = plannerAgent.agentPlan.functionSteps;
                        expect(add.functionName).toBe("aiAdd");
                        expect(subtract.functionName).toBe("aiSubtract");
                        expect(divide.functionName).toBe("aiDivide");
                        expect(multiply.functionName).toBe("aiMultiply");
                        trackResult("agentPlan.functionSteps are named correctly and in the correct order", true);
                    }catch{
                        trackResult("agentPlan.functionSteps are named correctly and in the correct order", false);
                        continue;
                    }

                    try{
                        const [add, subtract, divide, multiply] = plannerAgent.agentPlan.functionSteps;
                        expect(add.args['a']).toBe(5);
                        expect(add.args['b']).toBe(5);
                        expect(subtract.args['a']).toBe("$aiAdd.result");
                        expect(subtract.args['b']).toBe(1);
                        expect(divide.args['a']).toBe("$aiSubtract.result");
                        expect(divide.args['b']).toBe(3);
                        expect(multiply.args['a']).toBe("$aiDivide.result");
                        expect(multiply.args['b']).toBe(2);
                        trackResult("agentPlan.functionSteps function params are all correct", true);
                    }catch(e){
                        trackResult("agentPlan.functionSteps function params are all correct", false);
                        console.error(`##### function params were not correct: `, e);
                        console.log(`complete text from llm: `, completeText);
                        continue;
                    }

                    try{
                        expect(plannerAgent.isPlanCreationComplete).toBe(true);
                        trackResult('plannerAgent.isPlanCreationComplete is correct', true);
                    }catch{
                        trackResult('plannerAgent.isPlanCreationComplete is correct', false);
                        console.error(`aiCompletePlan was not called.  Complete text: `, completeText);
                        continue;
                    }



                } catch (err) {
                    console.error(`Iteration ${i + 1} failed with error:`, err);
                }

                totalSuccesses++;
            }

            // Compute final pass percentage
            // const totalAssertions = Object.keys(successCounts).reduce((sum, key) => sum + (successCounts[key] || 0) + (failureCounts[key] || 0), 0);
            // const totalSuccesses = Object.values(successCounts).reduce((sum, count) => sum + count, 0);
            const successRate = (totalSuccesses / iterations) * 100;

            console.log(`successCounts: `, successCounts);
            console.log(`failureCounts: `, failureCounts);
            console.log(`Test Summary: ${totalSuccesses}/${iterations}   ${successRate.toFixed(2)}%`);
            expect(successRate).toBeGreaterThanOrEqual(100);
        }, 15 * 60 * 1000);
        // it('It should create plans', async () => {
        //     const openAiWrapperService = testingModule.get<OpenaiWrapperService>(OpenaiWrapperService);
        //     const memberId = "1";
        //
        //     for(let i = 0; i < 5; i++){
        //         const plannerAgent = new PlannerAgent(model, openAiWrapperService, memberId);
        //         const {openAiMessages, completeText, totalOpenAiCallsMade} = await plannerAgent.createPlan("Add 5 to 5, then subtract 1, and divide by 3, then multiply by 2.");
        //
        //         console.log(`openAiMessages: `, JSON.stringify(openAiMessages, null, 2));
        //         expect(openAiMessages.length > 0).toBe(true);
        //
        //         //call 1: initial prompt along with tools available to the ai.
        //         //response 1: list of tools to call, along with parameters.  e.g. name: add, arguments: {a: 5, b: 5}
        //         //call 2: result of calling tool. e.g. 10
        //         //response 2: complete.
        //         expect(totalOpenAiCallsMade).toBe(2);
        //
        //         const assistantMessages = getMessageByRole('assistant', openAiMessages);
        //         expect(assistantMessages.length == 1).toBe(true);
        //         //@ts-ignore
        //         const assistantToolCalls = assistantMessages[0].tool_calls as ToolCall[];
        //         expect(assistantToolCalls.length).toBe(6);
        //         // const [createAiPlanToolCall, addFunctionStepForAdd, addFunctionStepForSubtract, addFunctionStepForDivide, addFunctionStepForMultiply, completePlan] = assistantToolCalls;
        //     }
        //
        // }, 1 * 60 * 1000);
    });
});

function getMessageByRole(role: string, openAiMessages: ChatCompletionMessageParam[]){
    return openAiMessages.filter(m => m.role === role);
}
