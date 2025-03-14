import {Message, MessageContext, ModelOrDatasourceOrPrompt} from '../models/api/conversationApiModels';
// import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { Observable } from 'rxjs';
import { encoding_for_model } from 'tiktoken';
const { v4: uuidv4 } = require('uuid');

export function uuid(){
  return uuidv4();
}

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
  const modelsAndDatasourcesAndPrompts = parseModelAndDatasourceAndPromptTagsFromMessage(text);
  const models: ModelOrDatasourceOrPrompt[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "model");
  const datasources: ModelOrDatasourceOrPrompt[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "datasource");
  const prompts: ModelOrDatasourceOrPrompt[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "prompt");
  //completely remove the <datasource id='123'>datasource name</datasource>
  let textWithoutTags = removeModelAndDatasourceTagsFromMessage(text);
  return {
    textWithoutTags, models, datasources, originalText: text, prompts
  };
}

export function replacePromptTagWithPromptTextFromDbById(input: string, promptId: string, promptTextFromDb: string): string {
  const regex = new RegExp(`<prompt[^>]*id=['"]${promptId}['"][^>]*>.*?<\/prompt>`, 'g');
  return input.replace(regex, promptTextFromDb);
}

/**
 * Used to convert <prompt id='123'>prompt text</prompt> into an object
 * { id: "123", type: "prompt"}
 * @param text
 */
export function parseModelAndDatasourceAndPromptTagsFromMessage(text: string): ModelOrDatasourceOrPrompt[] {
  const matches = [...text.matchAll(/<\s*(model|datasource|prompt)(?:\s+[^>]*?id=["']([^"']+)["'])?.*?>/gi)];

  return matches.map(match => ({
    id: match[2],
    type: match[1] as "model" | "datasource" | "prompt"
  }));
}

function removeModelAndDatasourceTagsFromMessage(text: string): string {
  return text.replace(/<\s*(model|datasource)[^>]*>.*?<\s*\/\s*\1\s*>\s*/gi, '');
}

export function wait(ms: number){
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


function getTokenCount(text: string){
  const tokenizer = encoding_for_model("gpt-3.5-turbo");
  return tokenizer.encode(text).length;
}

function getWordCount(text: string){
  return text.split(/\s+/).length;
}

export function getWordAndTokenCount(text: string){
  return {
    wordCount: getWordCount(text),
    tokenCount: getTokenCount(text),
  };
}

// Monday, October 25, 2024
export function getTodaysDate(){
  const today = new Date();

  // Get the day of the week
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = daysOfWeek[today.getDay()];

  // Get the month
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[today.getMonth()];

  // Get the day and year
  const day = today.getDate();
  const year = today.getFullYear();

  // Format the date
  const formattedDate = `${dayOfWeek}, ${month} ${day}, ${year}`;

  return formattedDate;
}
// export async function createObserver(){
//   return new Promise((resolve) => {
//     new Observable((observer) => {
//       resolve(observer);
//     })
//   })
// }
