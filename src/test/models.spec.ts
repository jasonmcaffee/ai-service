import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import { ModelsService } from '../services/models.service';
import { ModelsRepository } from '../repositories/models.repository';

describe("models", ()=>{
  let testingModule: TestingModule;
  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [ModelsService, ModelsRepository],
    }).compile();
  });

  it("should search hugging face for models", async ()=> {
    const modelsService = testingModule.get<ModelsService>(ModelsService);
    const result = await modelsService.searchModelsOnHuggingFace("gguf");
    console.log(`result: `, result);
  });
})
