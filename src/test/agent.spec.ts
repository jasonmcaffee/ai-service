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

        it('It should create plans', async () => {
            const openAiWrapperService = testingModule.get<OpenaiWrapperService>(OpenaiWrapperService);
            const memberId = "1";
            const iterations = 5;
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
            expect(successRate).toBeGreaterThanOrEqual(90);
        }, 5 * 60 * 1000);
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
