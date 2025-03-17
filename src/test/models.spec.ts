import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import { ModelsService } from '../services/models.service';
import { ModelsRepository } from '../repositories/models.repository';
import { wait } from '../utils/utils';

describe("models", ()=>{
  let testingModule: TestingModule;
  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [ModelsService, ModelsRepository],
    }).compile();
  });

  it("should search hugging face for models", async ()=> {
    const memberId = "2";
    const modelsService = testingModule.get<ModelsService>(ModelsService);
    const result = await modelsService.searchModelsOnHuggingFace("gguf");
    console.log(`result: `, result);
    const modelResult1 = result[0];
    const downloadFileResult = await modelsService.downloadFileFromHuggingFaceModel(memberId, modelResult1.modelId, "config.json");
    console.log(`done downloading file.`);

    const siblingGguf = modelResult1.siblings.find(s => s.rfilename.indexOf("gguf") > 0)?.rfilename!;
    const download2Promise = modelsService.downloadFileFromHuggingFaceModel(memberId, modelResult1.modelId, siblingGguf);
    await wait(25000);
    await modelsService.stopDownloadingHuggingFaceModelFile(memberId, siblingGguf);

  }, 5 * 60 * 1000);
})
