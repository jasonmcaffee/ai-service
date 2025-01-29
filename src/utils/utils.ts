import { Message } from '../models/api/conversationApiModels';
import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';


export function createOpenAIMessagesFromMessages(messages: Message[]){
  return messages.map((m) => {
    const role = m.sentByMemberId == "2" ? "system" : "user";
    return { role, content: m.messageText } as ChatCompletionMessageParam;
  });
}

export function formatDeepSeekResponse(deepSeekResponseText: string): string {
  return deepSeekResponseText.replace(/<think>[\s\S]*?<\/think>\n?/, '').trim();
}
