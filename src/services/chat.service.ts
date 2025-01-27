import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import OpenAI from 'openai';

@Injectable()
export class ChatService {
  async streamInference(prompt: string): Promise<Observable<string>> {
    const openai = new OpenAI({
      apiKey: '',
      baseURL: 'http://192.168.0.209:8080',
    });

    return new Observable((observer) => {
      openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }).then(async (stream) => {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            const text = JSON.stringify({text: content});
            observer.next(text);
          }
        }
        observer.complete();
      }).catch((error) => {
        observer.error(error);
      });
    });
  }
}
