import {Test, TestingModule} from "@nestjs/testing";
import {ModelsService} from "../services/models.service";
import {ModelsRepository} from "../repositories/models.repository";
import { OpenaiWrapperService } from '../services/openaiWrapper.service';
import PlannerAgent from '../models/agent/PlannerAgent';
import { Model } from '../models/api/conversationApiModels';

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
            const plannerAgent = new PlannerAgent(model, openAiWrapperService);

        });
    });
});
