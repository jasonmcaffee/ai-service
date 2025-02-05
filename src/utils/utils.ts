import {Message, MessageContext, ModelOrDatasource} from '../models/api/conversationApiModels';
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

export function extractMessageContextFromMessage(text: string): MessageContext{
  const modelsAndDatasources = parseModelAndDatasourceTagsFromMessage(text);
  const models: ModelOrDatasource[] = modelsAndDatasources.filter(m => m.type === "model");
  const datasources: ModelOrDatasource[] = modelsAndDatasources.filter(m => m.type === "datasource");
  const textWithoutTags = removeModelAndDatasourceTagsFromMessage(text);
  return {
    textWithoutTags, models, datasources, originalText: text,
  };
}

export function parseModelAndDatasourceTagsFromMessage(text: string): ModelOrDatasource[] {
  const matches = [...text.matchAll(/<\s*(model|datasource)(?:\s+[^>]*?id=["']([^"']+)["'])?.*?>/gi)];

  return matches.map(match => ({
    id: match[2],
    type: match[1] as "model" | "datasource"
  }));
}

function removeModelAndDatasourceTagsFromMessage(text: string): string {
  return text.replace(/<\s*(model|datasource)[^>]*>.*?<\s*\/\s*\1\s*>\s*/gi, '');
}