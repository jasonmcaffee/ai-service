import { AiFunctionExecutor } from '../../../models/agent/aiTypes';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NoToolsService implements AiFunctionExecutor<NoToolsService> {
  getToolsMetadata(): ChatCompletionTool[] {
    return [];
  }
}
