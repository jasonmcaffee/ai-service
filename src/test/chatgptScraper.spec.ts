import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiWrapperServiceV2 } from '../services/openAiWrapperV2.service';
import { CalculatorToolsService } from '../services/agent/tools/calculatorTools.service';
import { ChatgptScraperService } from '../services/scapers/chatgptScraper.service';
import { wait } from '../utils/utils';

describe("chatgpt scraper", ()=>{
  let testingModule: TestingModule;
  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [ChatgptScraperService],
    }).compile();
  });
  it("should scrape", async ()=>{
    const chatgptScraperService = testingModule.get<ChatgptScraperService>(ChatgptScraperService);
    chatgptScraperService.main('tell me a haiku', (text: string)=> {
      console.log(text);
    }, (completeText: string) => {
      console.log(completeText);
    });

    await wait(5 * 60 * 1000);
  }, 5 * 60 * 1000);
})
