import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { SpeechAudioSSESubject } from '../models/SpeechAudioSSESubject';
import { marked } from "marked";

type ActiveProcessContext = {
  abortController: AbortController;
  subject: SpeechAudioSSESubject;
}
@Injectable()
export class SpeechAudioService {
  private activeProcesses = new Map<string, ActiveProcessContext>();
  private activeTextToSpeechProcesses = new Map<string, ActiveProcessContext>();
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({ baseURL: 'http://192.168.0.209:8000/v1', apiKey: 'na', });
  }

  // transcribeAudioStreaming(file: any, language: string = 'en'): Observable<any> {
  //   const sessionId = uuidv4();
  //   const subject = new SpeechAudioSSESubject();
  //   const abortController = new AbortController();
  //   this.activeProcesses.set(sessionId, {subject, abortController});
  //
  //   const processAudio = async () => {
  //     const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}`);
  //
  //     try {
  //       // Write the uploaded file to a temporary location
  //       fs.writeFileSync(tempFilePath, file.buffer);
  //
  //       const start = Date.now();
  //       subject.sendProgress({ processingTime: 0 });
  //
  //       const speechToTextResult = await this.openAi.audio.transcriptions.create({
  //         // @ts-ignore
  //         model: 'Systran/faster-whisper-small',
  //         file: fs.createReadStream(tempFilePath),
  //         language: language,
  //       }, { signal: abortController.signal });
  //
  //       const processingTime = Date.now() - start;
  //       console.log(`Transcription finished in ${processingTime} ms: ${speechToTextResult.text}`);
  //
  //       subject.sendText(speechToTextResult.text);
  //       subject.sendCompleteOnNextTick();
  //     } catch (error) {
  //       if (!abortController.signal.aborted) {
  //         console.error(`Error processing uploaded audio: ${error.message}`);
  //         subject.sendError(error);
  //       }
  //     } finally {
  //       if (fs.existsSync(tempFilePath)) {
  //         fs.unlinkSync(tempFilePath);
  //       }
  //       this.activeProcesses.delete(sessionId);
  //     }
  //   };
  //
  //   processAudio();
  //   return subject.getSubject();
  // }

  async speechToTextSync(file: any, language: string = 'en'): Promise<string> {
    const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}`);

    try {
      // Write the uploaded file to a temporary location
      fs.writeFileSync(tempFilePath, file.buffer);

      const start = Date.now();

      const speechToTextResult = await this.openAi.audio.transcriptions.create({
        // @ts-ignore
        model: 'Systran/faster-whisper-small',
        file: fs.createReadStream(tempFilePath),
        language: language,
      });

      const processingTime = Date.now() - start;
      console.log(`Transcription finished in ${processingTime} ms: ${speechToTextResult.text}`);

      return speechToTextResult.text;
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  textToSpeechStreaming(memberId: string, text: string, model: string = 'hexgrad/Kokoro-82M', voice: string = 'af_sky', responseFormat: string = 'mp3', speed: number = 1): Observable<any> {
    const subject = new SpeechAudioSSESubject();
    const abortController = new AbortController();
    this.activeTextToSpeechProcesses.set(memberId, {subject, abortController});

    const generateSpeechForSentence = async (sentence: string) => {
      try {
        console.log(`generating speech for sentence: `, sentence);
        const start = Date.now();
        //@ts-ignore
        const result = await this.openAi.audio.speech.create({ model: model, voice: voice, input: sentence, response_format: responseFormat, speed: speed, },
          { signal: abortController.signal });

        const audioBuffer = await result.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        const processingTime = Date.now() - start;
        console.log(`Speech generation finished in ${processingTime} ms`);

        subject.sendAudio(base64Audio);
        // subject.sendCompleteOnNextTick();
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error(`Error generating speech: ${error.message}`);
          subject.sendError(error);
        }
      }
    };

    const generate = async (text: string) => {
      const sentences = splitTextIntoSentences(text);
      for(let s of sentences){
        if(abortController.signal.aborted){
          break;
        }
        await generateSpeechForSentence(s);
        this.activeProcesses.delete(memberId);
      }
      subject.sendCompleteOnNextTick();
    };

    generate(text);
    return subject.getSubject();
  }

  async textToSpeechSync(text: string, model: string = 'hexgrad/Kokoro-82M', voice: string = 'af_sky', responseFormat: string = 'mp3', speed: number = 1): Promise<Buffer> {
    try {
      const start = Date.now();
      //@ts-ignore
      const result = await this.openAi.audio.speech.create({ model: model,  voice: voice, input: text, response_format: responseFormat, speed: speed, });
      const audioBuffer = await result.arrayBuffer();
      const buffer = Buffer.from(audioBuffer);
      const processingTime = Date.now() - start;
      console.log(`Speech generation finished in ${processingTime} ms`);
      return buffer;
    } catch (error) {
      console.error(`Error generating speech: ${error.message}`);
      throw error;
    }
  }

  stopTextToSpeech(memberId: string): { success: boolean, message: string } {
    const context = this.activeTextToSpeechProcesses.get(memberId);
    if(!context){
      return { success: false, message: `No active processing found for member ${memberId}` };
    }
    const {abortController, subject} = context;

    abortController.abort();
    this.activeProcesses.delete(memberId);
    subject.sendCompleteOnNextTick();
    return { success: true, message: `Processing for session ${memberId} was cancelled` };
  }
}

const maxWordsPerSentence = 50;
function splitTextIntoSentences(text: string): string[] {
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

async function markdownToPlainText(markdown: string): Promise<string> {
  const renderer = new marked.Renderer();

  // Override rendering functions to extract plain text
  renderer.paragraph = (text) => text + "\n";
  renderer.heading = (text) => text + "\n";
  renderer.list = (body) => body.items.join("\n");
  renderer.listitem = (text) => `- ${text}\n`;
  renderer.blockquote = (text) => `"${text}"\n`;
  renderer.code = (code) => `${code}\n`;
  renderer.strong = (text) => text.text;
  renderer.em = (text) => text.text;
  renderer.codespan = (text) => text.text;
  renderer.table = (token) => token.header + "\n" + token.rows.join("\n");
  renderer.tablerow = (content) => content + "\n";
  renderer.tablecell = (content) => content + " | ";
  renderer.link = ({href, title, tokens}) => title || '';
  renderer.image = ({href, title, text}) => text;
  renderer.hr = () => "\n";
  renderer.br = () => "\n";

  return await marked(markdown, { renderer });
}
