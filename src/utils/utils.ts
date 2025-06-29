import {
  Message,
  MessageContext,
  ModelOrDatasourceOrPromptOrAgent,
  StatusUpdateTopicType,
} from '../models/api/conversationApiModels';
import * as sharp from 'sharp';

// import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { Observable } from 'rxjs';
import { encoding_for_model } from 'tiktoken';
import { marked } from 'marked';
const { v4: uuidv4 } = require('uuid');
const he = require('he');
import { convert } from 'html-to-text';
import { AiFunctionContextV2 } from '../models/agent/aiTypes';

export function uuid(){
  return uuidv4();
}

export function removeThinkTagFromLLMResponse(llmResponse: string): string {
  return llmResponse.replace(/<think>[\s\S]*?<\/think>\n?/, '').trim();
}

export function extractMessageContextFromMessage(text: string): MessageContext{
  const modelsAndDatasourcesAndPrompts = parseModelAndDatasourceAndPromptTagsFromMessage(text);
  const models: ModelOrDatasourceOrPromptOrAgent[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "model");
  const datasources: ModelOrDatasourceOrPromptOrAgent[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "datasource");
  const prompts: ModelOrDatasourceOrPromptOrAgent[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "prompt");
  const agents: ModelOrDatasourceOrPromptOrAgent[] = modelsAndDatasourcesAndPrompts.filter(m => m.type === "agent");
  //completely remove the <datasource id='123'>datasource name</datasource>
  let textWithoutTags = removeModelAndDatasourceAndAgentTagsFromMessage(text);
  return {
    textWithoutTags, models, datasources, originalText: text, prompts, agents,
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
export function parseModelAndDatasourceAndPromptTagsFromMessage(text: string): ModelOrDatasourceOrPromptOrAgent[] {
  const matches = [...text.matchAll(/<\s*(model|datasource|prompt|agent)(?:\s+[^>]*?id=["']([^"']+)["'])?.*?>/gi)];

  return matches.map(match => ({
    id: match[2],
    type: match[1] as "model" | "datasource" | "prompt" | "agent"
  }));
}

function removeModelAndDatasourceAndAgentTagsFromMessage(text: string): string {
  return text.replace(/<\s*(model|datasource|agent)[^>]*>.*?<\s*\/\s*\1\s*>\s*/gi, ''); //NOTE: do not do prompt here so prompt replacement can occur.
}

function removePromptTagsFromMessage(text: string): string {
  return text.replace(/<\s*(prompt)[^>]*>.*?<\s*\/\s*\1\s*>\s*/gi, ''); //NOTE: do not do prompt here so prompt replacement can occur.
}

export function wait(ms: number){
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


function getTokenCount(text: string){
  try{
    const tokenizer = encoding_for_model("gpt-3.5-turbo");
    return tokenizer.encode(text).length;
  }catch(e){ //<|endoftext|>
    console.error(`unable to get token count`, e);
    return getWordCount(text);
  }

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
function getElementText(elem: any): string {
  if (elem.type === 'text') {
    return elem.data;
  } else if (elem.type === 'tag' && elem.children) {
    return elem.children.map(getElementText).join('');
  }
  return '';
}

// Formatter for headers to add a period if necessary
const headerFormatter = (elem, walk, builder) => {
  const headerText = getElementText(elem).trim();
  builder.openBlock({ leadingLineBreaks: 2 });
  walk(elem.children, builder);
  if (!/[.!?]$/.test(headerText)) {
    builder.addInline('.');
  }
  builder.closeBlock({ trailingLineBreaks: 2 });
};

// Formatter for numbering all lists with a colon
const numberedListFormatter = (elem, walk, builder) => {
  builder.openList({ ordered: true });
  let index = 1;
  for (const child of elem.children) {
    if (child.name === 'li') {
      const prefix = `${index}: `;
      builder.openListItem({ prefix });
      walk(child.children, builder);
      builder.closeListItem();
      index++;
    }
  }
  builder.closeList();
};

// Updated function with new name and list formatting
export function convertMarkdownToPlainText(markdown: string): string {
  // Convert Markdown to HTML
  const html = marked.parse(markdown);

  // Convert HTML to plain text with custom formatting
  const text = convert(html, {
    formatters: {
      // Handle links: output only the link text
      'anchor': (elem, walk, builder) => {
        walk(elem.children, builder);
      },
      // Handle images: output alt text if available
      'image': (elem, walk, builder) => {
        if (elem.attribs && elem.attribs.alt) {
          builder.addInline(elem.attribs.alt);
        }
      },
      // Handle code blocks: replace with "[code block]"
      'codeBlock': (elem, walk, builder) => {
        builder.addInline('[code block]');
      },
      // Apply header formatter to all header levels
      'h1': headerFormatter,
      'h2': headerFormatter,
      'h3': headerFormatter,
      'h4': headerFormatter,
      'h5': headerFormatter,
      'h6': headerFormatter,
      // Custom formatter for numbered lists
      'numberedList': numberedListFormatter,
    },
    selectors: [
      { selector: 'a', format: 'anchor' },
      { selector: 'img', format: 'image' },
      { selector: 'pre', format: 'codeBlock' },
      { selector: 'h1', format: 'h1' },
      { selector: 'h2', format: 'h2' },
      { selector: 'h3', format: 'h3' },
      { selector: 'h4', format: 'h4' },
      { selector: 'h5', format: 'h5' },
      { selector: 'h6', format: 'h6' },
      { selector: 'ol', format: 'numberedList' },
      { selector: 'ul', format: 'numberedList' },
    ],
    wordwrap: null,        // Preserve original line structure
    preserveNewlines: true // Keep newlines for readability
  });

  // Post-process the text
  const plainText = text
    .replace(/ +/g, ' ')        // Normalize multiple spaces to one
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to two
    .replace(/ +\./g, '.')      // Remove spaces before periods
    .trim();                    // Remove leading/trailing whitespace

  return plainText;
}

const htmlDecode = (input) => {
  return input ? he.decode(input) : "";
};

/**
 *
 * @param func - function to execute.  Is passed a sendStatus function for when other status updates need to be sent.
 * @param context
 * @param topic
 * @param displayText
 */
export async function withStatus<TResult>(func:  (sendStatus: (text: string, data?: any) => void) => Promise<TResult>, {context, topic, displayText}: {context: AiFunctionContextV2, topic: StatusUpdateTopicType, displayText: string}){
  const subject = context.inferenceSSESubject;
  const topicId = uuid();
  const startTimeMs = Date.now();
  const sendStatus = (t: string, data?: any) => {
    subject?.sendStatus({topicId, topic, displayText: t, timeTakenInMs: Date.now() - startTimeMs, data});
  };
  try{
    subject?.sendStatus({topicId, topic, displayText});
    const result = await func(sendStatus);
    subject?.sendStatus({topicId, topic, displayText: `Completed: ${displayText}`, topicCompleted: true, timeTakenInMs: Date.now() - startTimeMs});
    return result;
  } catch (e){
    subject?.sendStatus({topicId, topic, displayText: `Error: ${e.message}`, isError: true, topicCompleted: true, timeTakenInMs: Date.now() - startTimeMs});
    throw e;
  }
}



export async function createOpenAIMessagesFromMessages(messages: Message[]){
  const newMessages = [] as ChatCompletionMessageParam[];
  let newMessage: ChatCompletionMessageParam;
  for(let m of messages){
    let content = m.messageText;
    let tool_calls = undefined;
    let tool_call_id = undefined;
    if(m.role === 'assistant' && m.toolCallsJson){
      try{
        tool_calls = JSON.parse(m.toolCallsJson);
      }catch(e){
        console.error(`couldn't parse tool calls`, e);
      }
    }
    if(m.role == 'tool'){
      try{
        const toolContent = JSON.parse(m.messageText);
        content = toolContent.content;
        tool_call_id = toolContent.tool_call_id;
      }catch(e){
        console.error(`couldn't parse tool content`, e);
      }
    }
    if(!m.imageUrl){
      newMessage = { role: m.role, content, tool_calls, tool_call_id} as ChatCompletionMessageParam;
    }else{
      const startTime = Date.now();
      const compressedImageUrl = await compressBase64Image(m.imageUrl, 50, 'jpeg');
      console.log(`image compressed in ${Date.now() - startTime} ms.  orig: ${m.imageUrl.length}, new: ${compressedImageUrl.length}`);
      newMessage = { role: m.role, content: [
          {type: 'text', text: content},
          {type:'image_url', image_url: { url: compressedImageUrl}}
        ], tool_calls, tool_call_id} as ChatCompletionMessageParam;
    }
    newMessages.push(newMessage);
  }
  return newMessages;
}

export async function compressBase64Image(base64Image: string, quality: number = 80, format: 'jpeg' | 'webp' | 'png' = 'jpeg'): Promise<string> {
  try {
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const inputBuffer = Buffer.from(base64Data, 'base64');
    let sharpInstance = sharp(inputBuffer);
    let outputBuffer: Buffer;

    switch (format) {
      case 'jpeg':
        outputBuffer = await sharpInstance.jpeg({ quality, progressive: true }).toBuffer();
        break;

      case 'webp':
        outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
        break;

      case 'png':
        // PNG compression works differently - use compressionLevel instead of quality
        const compressionLevel = Math.round((100 - quality) / 10); // Convert quality to compression level (0-9)
        outputBuffer = await sharpInstance.png({ compressionLevel: Math.min(9, Math.max(0, compressionLevel)) }).toBuffer();
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Convert back to base64
    const compressedBase64 = outputBuffer.toString('base64');
    const result = `data:image/${format};base64,${compressedBase64}`;
    return result;
  } catch (error) {
    throw new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
