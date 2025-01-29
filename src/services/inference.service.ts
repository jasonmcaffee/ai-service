import { Injectable } from '@nestjs/common';
import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import OpenAI from 'openai';

@Injectable()
export class InferenceService{
  constructor() {
  }
  /**
   * sends all messages for the conversation to openai, along with last prompt.
   * doesn't add to the conversation.
   * @param memberId
   * @param prompt
   * @param conversationId
   */
  async nonStreamingInference(openAiMessages: ChatCompletionMessageParam[]){
    const openai = new OpenAI({ apiKey: '', baseURL: 'http://192.168.0.209:8080' });

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: openAiMessages,
        stream: false,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      throw error;
    }
  }
}
