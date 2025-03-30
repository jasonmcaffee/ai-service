import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { SpeechAudioSSESubject } from '../models/SpeechAudioSSESubject';


@Injectable()
export class SpeechAudioService {
  private activeProcesses = new Map<string, AbortController>();
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({
      baseURL: 'http://192.168.0.209:8000/v1',
      apiKey: 'na',
    });
  }

  streamTranscription(): Observable<any> {
    const sessionId = uuidv4();
    const subject = new SpeechAudioSSESubject();
    const abortController = new AbortController();
    this.activeProcesses.set(sessionId, abortController);

    const audioChunks: Buffer[] = [];
    let isRecording = true;

    const collectAndProcessAudio = async () => {
      try {
        while (isRecording && !abortController.signal.aborted) {
          // Process audio every 3 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));

          // In a real implementation, this would be populated with actual audio buffer data
          // from a WebSocket or other streaming source
          const audioChunk = Buffer.from([]); // This would be actual audio data in real implementation

          const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.wav`);

          const start = Date.now();
          try {
            subject.sendProgress({ processingTime: 0 });

            // In a real implementation, you'd write the actual audio buffer to the temp file
            fs.writeFileSync(tempFilePath, audioChunk);

            const speechToTextResult = await this.openAi.audio.transcriptions.create({
              // @ts-ignore
              model: 'Systran/faster-whisper-small',
              file: fs.createReadStream(tempFilePath),
              language: 'en',
            }, { signal: abortController.signal });

            const processingTime = Date.now() - start;
            console.log(`Transcription finished in ${processingTime} ms: ${speechToTextResult.text}`);

            subject.sendText(speechToTextResult.text);
            fs.unlinkSync(tempFilePath);
          } catch (error) {
            if (!abortController.signal.aborted) {
              console.error(`Error processing audio: ${error.message}`);
              subject.sendError(error);
              isRecording = false;
            }
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          }
        }

        if (!abortController.signal.aborted) {
          subject.sendComplete();
        }
        this.activeProcesses.delete(sessionId);
      } catch (error) {
        console.error(`Error in audio stream: ${error.message}`);
        if (!abortController.signal.aborted) {
          subject.sendError(error);
        }
        this.activeProcesses.delete(sessionId);
      }
    };

    collectAndProcessAudio();
    return subject.getSubject();
  }

  transcribeAudio(file: any, language: string = 'en'): Observable<any> {
    const sessionId = uuidv4();
    const subject = new SpeechAudioSSESubject();
    const abortController = new AbortController();
    this.activeProcesses.set(sessionId, abortController);

    const processAudio = async () => {
      const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}`);

      try {
        // Write the uploaded file to a temporary location
        fs.writeFileSync(tempFilePath, file.buffer);

        const start = Date.now();
        subject.sendProgress({ processingTime: 0 });

        const speechToTextResult = await this.openAi.audio.transcriptions.create({
          // @ts-ignore
          model: 'Systran/faster-whisper-small',
          file: fs.createReadStream(tempFilePath),
          language: language,
        }, { signal: abortController.signal });

        const processingTime = Date.now() - start;
        console.log(`Transcription finished in ${processingTime} ms: ${speechToTextResult.text}`);

        subject.sendText(speechToTextResult.text);
        subject.sendCompleteOnNextTick();
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error(`Error processing uploaded audio: ${error.message}`);
          subject.sendError(error);
        }
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        this.activeProcesses.delete(sessionId);
      }
    };

    processAudio();
    return subject.getSubject();
  }

  async transcribeAudioSync(file: any, language: string = 'en'): Promise<string> {
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

  textToSpeech(text: string, model: string = 'hexgrad/Kokoro-82M', voice: string = 'af_sky', responseFormat: string = 'mp3', speed: number = 1): Observable<any> {
    const sessionId = uuidv4();
    const subject = new SpeechAudioSSESubject();
    const abortController = new AbortController();
    this.activeProcesses.set(sessionId, abortController);

    const generateSpeech = async () => {
      try {
        const start = Date.now();
        subject.sendProgress({ processingTime: 0 });

        const result = await this.openAi.audio.speech.create({
          model: model,
          // @ts-ignore
          voice: voice,
          input: text,
          //@ts-ignore
          response_format: responseFormat,
          speed: speed,
        }, { signal: abortController.signal });

        const audioBuffer = await result.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        const processingTime = Date.now() - start;
        console.log(`Speech generation finished in ${processingTime} ms`);

        subject.sendAudio(base64Audio);
        subject.sendCompleteOnNextTick();
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error(`Error generating speech: ${error.message}`);
          subject.sendError(error);
        }
      } finally {
        this.activeProcesses.delete(sessionId);
      }
    };

    generateSpeech();
    return subject.getSubject();
  }

  async textToSpeechSync(
    text: string,
    model: string = 'hexgrad/Kokoro-82M',
    voice: string = 'af_sky',
    responseFormat: string = 'mp3',
    speed: number = 1
  ): Promise<Buffer> {
    try {
      const start = Date.now();

      const result = await this.openAi.audio.speech.create({
        model: model,
        // @ts-ignore
        voice: voice,
        input: text,
        //@ts-ignore
        response_format: responseFormat,
        speed: speed,
      });

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

  cancelAudioProcessing(sessionId: string): { success: boolean, message: string } {
    const abortController = this.activeProcesses.get(sessionId);

    if (abortController) {
      abortController.abort();
      this.activeProcesses.delete(sessionId);
      return { success: true, message: `Processing for session ${sessionId} was cancelled` };
    }

    return { success: false, message: `No active processing found for session ${sessionId}` };
  }
}
