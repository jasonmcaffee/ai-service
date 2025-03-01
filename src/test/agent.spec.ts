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

            for(let i = 0; i < 5; i++){
                const plannerAgent = new PlannerAgent(model, openAiWrapperService, memberId);
                const {openAiMessages, completeText, totalOpenAiCallsMade} = await plannerAgent.createPlan("Add 5 to 5, then subtract 1, and divide by 3, then multiply by 2.");

                console.log(`openAiMessages: `, JSON.stringify(openAiMessages, null, 2));
                expect(openAiMessages.length > 0).toBe(true);

                expect(totalOpenAiCallsMade).toBe(2);

                const assistantMessages = getMessageByRole('assistant', openAiMessages);
                expect(assistantMessages.length == 1).toBe(true);
                //@ts-ignore
                const assistantToolCalls = assistantMessages[0].tool_calls as ToolCall[];
                expect(assistantToolCalls.length).toBe(6);
                const [createAiPlanToolCall, addFunctionStepForAdd, addFunctionStepForSubtract, addFunctionStepForDivide, addFunctionStepForMultiply, completePlan] = assistantToolCalls;
            }

        });
    });
});

function getMessageByRole(role: string, openAiMessages: ChatCompletionMessageParam[]){
    return openAiMessages.filter(m => m.role === role);
}
