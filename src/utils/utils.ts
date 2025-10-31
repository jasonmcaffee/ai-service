import {
  Message,
  MessageContext,
  ModelOrDatasourceOrPromptOrAgent,
  StatusUpdateTopicType,
} from '../models/api/conversationApiModels';
import * as sharp from 'sharp';

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

// export function splitTextIntoSentences(text: string, maxWordsPerSentence = 50): string[] {
//   const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
//   const sentences = text.match(sentenceRegex) || [];
//   const result: string[] = [];
//   for(let sentence of sentences){
//     let words = sentence.split(" ");
//     if(words.length >= maxWordsPerSentence){
//       while(words.length > maxWordsPerSentence){
//         const nextSentenceWords = words.splice(0, maxWordsPerSentence);
//         const nextSentence = nextSentenceWords.join(" ");
//         result.push(nextSentence);
//   }
//       const nextSentenceWords = words.splice(0, maxWordsPerSentence);
//       const nextSentence = nextSentenceWords.join(" ");
//       result.push(nextSentence);
//     }else{
//       result.push(sentence);
//     }
//   }
//   return result;
// }

export function splitTextIntoSentencesV2(text: string, maxWordsPerSentence = 50): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Common abbreviations that shouldn't end sentences (with and without periods)
  const abbreviations = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'viz', 'i.e', 'e.g', 'ie', 'eg',
    'am', 'pm', 'a.m', 'p.m', 'ad', 'bc', 'b.c', 'a.d',
    'no', 'nos', 'vol', 'pp', 'ed', 'eds', 'rev', 'approx', 'est', 'min', 'max',
    'inc', 'ltd', 'corp', 'co', 'llc', 'st', 'ave', 'blvd', 'rd',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
    'u.s', 'u.k', 'u.n', 'e.u', 'usa', 'nato', 'fbi', 'cia', 'irs', 'fda', 'epa',
    'ph.d', 'm.d', 'b.a', 'm.a', 'b.s', 'm.s', 'phd', 'md', 'ba', 'ma', 'bs', 'ms'
  ]);

  const sentences: string[] = [];
  let currentSentence = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = i + 1 < text.length ? text[i + 1] : '';
    const prevChar = i > 0 ? text[i - 1] : '';

    currentSentence += char;

    // Check for sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?') {
      let isEndOfSentence = false;

      // Handle ellipsis - skip first two dots, but third dot can end sentence
      if (char === '.' && (prevChar === '.' || nextChar === '.')) {
        // Check if this is the third dot (prevChar is '.') and should split
        if (prevChar === '.' && /\s/.test(nextChar)) {
          const afterWhitespace = text.slice(i + 1).trim();
          const firstCharAfter = afterWhitespace[0] || '';
          if (firstCharAfter && /[A-Z]/.test(firstCharAfter)) {
            // Third dot of ellipsis followed by capital - end of sentence
            // Continue processing this dot as sentence end
          } else {
            // Ellipsis in middle - skip this dot
            i++;
            continue;
          }
        } else {
          // Still part of ellipsis, skip
          i++;
          continue;
        }
      }

      // Check if followed by whitespace (or end of string) and potentially a capital letter
      if (/\s/.test(nextChar) || nextChar === '') {
        const beforePeriod = currentSentence.slice(0, -1).trim();
        const lastFewWords = beforePeriod.split(/\s+/).slice(-3).join(' ');
        const lastWord = beforePeriod.split(/\s+/).pop() || '';
        const lastWordClean = lastWord.toLowerCase().replace(/[^\w\.]/g, '');

        // Check for decimal numbers - look for digit.digit pattern near the period
        const hasDecimal = /\d+\.\d+/.test(lastFewWords);
        
        // Check for URLs - look for URL patterns
        const hasUrl = /(www\.|http:\/\/|https:\/\/|\.com|\.org|\.net|\.edu|\.gov|\.io)/i.test(lastFewWords);
        
        // Check for abbreviation (word with period, like "Mr.", "e.g.", "i.e.")
        // Handle both "e.g." and "e.g" cases, and also check if last word before period is abbreviation
        const lastWordNoPeriod = lastWord.replace(/\.$/, '');
        const lastWordLower = lastWordNoPeriod.toLowerCase();
        // Check with dots preserved (e.g., "e.g", "i.e", "p.m") and without dots
        const isKnownAbbreviation = abbreviations.has(lastWordLower) || 
                                   abbreviations.has(lastWordLower.replace(/\./g, ''));
        
        // Check for single letter abbreviation (e.g., "J.", "A.")
        const isSingleLetterAbbr = /^[a-zA-Z]\.$/.test(lastWord);
        
        // Check for all caps abbreviation without period (e.g., "FBI", "CIA") when followed by period
        const allCapsWord = lastWordNoPeriod.replace(/[^\w]/g, '');
        const isAllCapsAbbr = /^[A-Z]{2,5}$/.test(allCapsWord);
        
        // Check for all caps with periods (e.g., "U.S.A.", "C.I.A.")
        const allCapsWithPeriods = lastWord.replace(/[^\w\.]/g, '');
        const isAllCapsPeriodAbbr = /^[A-Z](\.[A-Z])+\.?$/.test(allCapsWithPeriods);
        
        // Check for academic titles (Ph.D., M.D., etc.)
        const isAcademicAbbr = /^(ph\.d|m\.d|b\.a|m\.a|b\.s|m\.s|phd|md|ba|ma|bs|ms)\.?$/i.test(lastWordClean);

        // Determine if this period should NOT end a sentence
        const isAbbreviation = isKnownAbbreviation || isSingleLetterAbbr || hasDecimal || hasUrl || 
                               isAllCapsAbbr || isAllCapsPeriodAbbr || isAcademicAbbr;

        // Get what comes after this punctuation
        const afterWhitespace = text.slice(i + 1).trim();
        const firstCharAfter = afterWhitespace[0] || '';

        // Check if period might be inside quotes followed by sentence start
        // Pattern: "text." Capital letter - this should split
        const hasQuoteInSentence = /["']/.test(beforePeriod);
        
        // Determine if sentence should end
        // Be very conservative: don't split on decimals/URLs even if followed by capital
        // Only split when it's clearly a sentence boundary
        if (char === '!' || char === '?') {
          // Always end on ! or ?
          isEndOfSentence = true;
        } else if (firstCharAfter === '') {
          // End of text
          isEndOfSentence = true;
        } else if (isSingleLetterAbbr) {
          // Never split on single-letter abbreviations (middle initials)
          // These are always part of names
          isEndOfSentence = false;
        } else if (hasDecimal || hasUrl) {
          // Don't split on decimals or URLs - very conservative
          // (these tests expect them to never split)
          isEndOfSentence = false;
        } else if (hasQuoteInSentence && /[A-Z]/.test(firstCharAfter) && !isAbbreviation) {
          // Period in quotes, followed by capital, not abbreviation - likely sentence end
          // (handles cases like '"Hello world." That was nice.')
          isEndOfSentence = true;
        } else if (!isAbbreviation && /[A-Z]/.test(firstCharAfter)) {
          // Only split if NOT an abbreviation and capital letter follows
          // This handles normal sentence endings
          isEndOfSentence = true;
        } else if (isAllCapsAbbr && /[A-Z]/.test(firstCharAfter) && !isAllCapsPeriodAbbr) {
          // All-caps abbreviations (like FBI) at sentence boundaries should split
          // But U.S.A. style should not split (handled by isAllCapsPeriodAbbr)
          isEndOfSentence = true;
        }
      } else if (nextChar === '') {
        // End of text with punctuation
        isEndOfSentence = true;
      }

      if (isEndOfSentence) {
        sentences.push(currentSentence.trim());
        currentSentence = '';
        // Skip whitespace after sentence ending
        i++;
        while (i < text.length && /\s/.test(text[i])) {
          i++;
        }
        continue;
      }
    }

    i++;
  }

  // Add remaining text as last sentence if any
  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim());
  }

  // Handle maxWordsPerSentence splitting
  const result: string[] = [];
  for (let sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    if (words.length >= maxWordsPerSentence) {
      while (words.length > maxWordsPerSentence) {
        const nextSentenceWords = words.splice(0, maxWordsPerSentence);
        const nextSentence = nextSentenceWords.join(' ');
        result.push(nextSentence);
      }
      if (words.length > 0) {
        const nextSentence = words.join(' ');
        result.push(nextSentence);
      }
    } else {
      result.push(sentence);
    }
  }

  return result.filter(s => s.length > 0);
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
