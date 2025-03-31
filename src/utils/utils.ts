import {Message, MessageContext, ModelOrDatasourceOrPrompt} from '../models/api/conversationApiModels';
// import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { Observable } from 'rxjs';
import { encoding_for_model } from 'tiktoken';
import { marked } from 'marked';
const { v4: uuidv4 } = require('uuid');
const he = require('he');

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

export function splitTextIntoSentences(text: string, maxWordsPerSentence = 50): string[] {
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [];
  const result: string[] = [];
  for(let sentence of sentences){
    let words = sentence.split(" ");
    if(words.length >= maxWordsPerSentence){
      while(words.length > maxWordsPerSentence){
        const nextSentenceWords = words.splice(0, maxWordsPerSentence);
        const nextSentence = nextSentenceWords.join(" ");
        result.push(nextSentence);
      }
      const nextSentenceWords = words.splice(0, maxWordsPerSentence);
      const nextSentence = nextSentenceWords.join(" ");
      result.push(nextSentence);
    }else{
      result.push(sentence);
    }
  }
  return result;
}

export function convertMarkdownToPlainText(markdown: string): string {
  // Initialize the marked lexer to tokenize markdown
  const tokens = marked.lexer(markdown);
  // Process tokens and convert to plain text
  let plainText = processTokens(tokens);
  plainText = plainText.replace(/\*\*/g, ''); // Remove bold markers
  plainText = plainText.replace(/\*/g, '');   // Remove italic markers
  plainText = plainText.replace(/\_\_/g, ''); // Remove alternate bold markers
  plainText = plainText.replace(/\_/g, '');   // Remove alternate italic markers
  plainText = plainText.replace(/\`/g, '');   // Remove code markers
  // Handle any remaining HTML entities
  plainText = htmlDecode(plainText);
  return plainText;
}

const htmlDecode = (input) => {
  return input ? he.decode(input) : "";
};
/**
 * Process an array of tokens and convert to plain text
 */
function processTokens(tokens: any[]): string {
  let result = '';
  for (const token of tokens) {
    result += processToken(token);
  }
  return result.trim();
}

/**
 * Process a single token and convert to plain text
 */
function processToken(token: any): string {
  switch (token.type) {
    case 'paragraph':
      return processTokens(token.tokens) + '\n\n';
    case 'heading':
      return processTokens(token.tokens) + '.\n\n';
    case 'text':
      // Replace HTML entities in the text
      return htmlDecode(token.text);
    case 'strong':
      return processTokens(token.tokens);
    case 'em':
      return processTokens(token.tokens);
    case 'codespan':
      return token.text + ' ';
    case 'code':
      return `The following is code: ${token.text}\n\n`;
    case 'link':
      return processTokens(token.tokens);
    case 'image':
      return `Image: ${token.text}. `;
    case 'list': {
      let listText = '\n';
      for (let i = 0; i < token.items.length; i++) {
        if (token.ordered) {
          listText += `${i + 1}. ${processToken(token.items[i])}\n`;
        } else {
          listText += `• ${processToken(token.items[i])}\n`;
        }
      }
      return listText + '\n';
    }
    case 'list_item':
      return processTokens(token.tokens).trim();
    case 'blockquote':
      return `Quote: ${processTokens(token.tokens)}\n\n`;
    case 'hr':
      return '\n\n';
    case 'html':
      return '';
    case 'table': {
      let tableText = '\n';
      if (token.header && token.header.length > 0) {
        for (const cell of token.header) {
          tableText += processTokens(cell.tokens) + '. ';
        }
        tableText += '\n';
      }
      for (const row of token.rows) {
        for (const cell of row) {
          tableText += processTokens(cell.tokens) + '. ';
        }
        tableText += '\n';
      }
      return tableText + '\n';
    }
    case 'del':
      return processTokens(token.tokens);
    case 'space':
      return '\n\n';
    default:
      if (token.tokens) {
        return processTokens(token.tokens);
      }
      if (token.items) {
        let result = '';
        for (const item of token.items) {
          result += processToken(item);
        }
        return result;
      }
      return token.raw || '';
  }
}



// export async function createObserver(){
//   return new Promise((resolve) => {
//     new Observable((observer) => {
//       resolve(observer);
//     })
//   })
// }
