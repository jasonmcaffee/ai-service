import { Injectable } from '@nestjs/common';
import { WebToolsService } from './tools/webTools.service';
import { OpenaiWrapperServiceV2 } from '../openAiWrapperV2.service';

@Injectable()
export class WebSearchAgent{
  constructor(
    private readonly webToolsService: WebToolsService,
    private readonly openAiWrapperService: OpenaiWrapperServiceV2,
  ) {
  }

  async handlePrompt(prompt){
    const result = `Latest news headlines:
      # Tariffs are great!
      # World economy is doing fine.
      # Everyone is actually pretty happy with how things are going.
      # Stock prices are up!
     `;
    return result;
  }

}
