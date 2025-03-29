import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OpenAI, toFile } from 'openai';
import { Readable } from 'stream';
import { AuthenticationService } from './authentication.service';
import * as fs from 'fs';

interface ClientState {
  buffer: Buffer[];
  intervalId: NodeJS.Timeout | null;
  isProcessing: boolean;
  abortController: AbortController | null;
  model: string;
  language?: string;
  clientId: string; // Store client id for potential logging/debugging
}

const processAudioEveryNms = 5 * 1000;

@Injectable()
export class SpeechToTextService implements OnModuleDestroy {
  private readonly openAi: OpenAI;
  private readonly clientStates = new Map<string | number, ClientState>(); // Keyed by memberId

  // Inject your actual AuthenticationService here
  constructor(private readonly authenticationService: AuthenticationService) {
    // Configure OpenAI client directly
    this.openAi = new OpenAI({
      baseURL: 'http://192.168.0.209:8000/v1', // Your custom endpoint
      apiKey: 'na', // API key as specified
      timeout: 30 * 1000, // Example: 30 second timeout
    });
    console.log(
      'SpeechToTextService initialized with OpenAI baseURL:',
      this.openAi.baseURL,
    );
  }

  // Called when the NestJS application shuts down
  onModuleDestroy() {
    console.log('Cleaning up client states on module destroy...');
    // Create a copy of keys because cleanupClient modifies the map
    const memberIds = Array.from(this.clientStates.keys());
    memberIds.forEach((memberId) => {
      this.cleanupClient(memberId);
    });
    this.clientStates.clear();
    console.log('Client states cleared.');
  }

  handleClientConnection(memberId: string, clientId: string, model: string, language?: string,): void {
    console.log(`Client connected: MemberId=${memberId}, ClientId=${clientId}, Model=${model}, Language=${language || 'auto'}`,);
    // Check if already connected (e.g., rapid reconnect)
    if (this.clientStates.has(memberId)) {
      console.warn(`Member ${memberId} already has an active connection. Cleaning up old one.`);
      this.cleanupClient(memberId);
    }
    this.clientStates.set(memberId, {
      buffer: [],
      intervalId: null,
      isProcessing: false,
      abortController: null,
      model: model,
      language: language,
      clientId: clientId,
    });
  }

  handleClientDisconnect(memberId: string | number): void {
    console.log(`Client disconnected: MemberId=${memberId}`);
    this.cleanupClient(memberId);
    this.clientStates.delete(memberId);
  }

  addAudioChunk(memberId: string, chunk: Buffer): void {
    const clientState = this.clientStates.get(memberId);
    if (!clientState) {
      console.warn(`Received chunk for unknown or disconnected member: ${memberId}`,);
      return;
    }

    clientState.buffer.push(chunk);

    if (!clientState.intervalId) {
      console.log(`Starting processing interval for member: ${memberId}`);
      clientState.intervalId = setInterval( () => this.processBufferedAudio(memberId), processAudioEveryNms,);
    }
  }

  async processBufferedAudio(memberId: string | number): Promise<void> {
    const clientState = this.clientStates.get(memberId);
    // Check if client disconnected or processing is already ongoing
    if (!clientState || clientState.isProcessing) {
      return;
    }
    // Atomically get chunks and reset buffer for the next interval
    const audioChunks = clientState.buffer.splice(0, clientState.buffer.length);
    if (audioChunks.length === 0) {
      return;
    }
    clientState.isProcessing = true;
    const abortController = new AbortController();
    clientState.abortController = abortController;

    const combinedBuffer = Buffer.concat(audioChunks);
    console.log(`Processing ${combinedBuffer.length} bytes of audio`,);

    try {
      // const fileArgument = await toFile(combinedBuffer, 'audio.webm', {type: "audio/webm"});
      const fileArgument = await toFile(combinedBuffer, `audio-${Date.now()}.wav`, {type: "audio/wav"});

      // fs.writeFileSync(`./audio-${Date.now()}.wav`, combinedBuffer);
      console.log(`Sending to OpenAI (Model: ${clientState.model}, Lang: ${clientState.language})...`,);
      const start = Date.now();
      const speechToTextResult = await this.openAi.audio.transcriptions.create({
          file: fileArgument,
          model: clientState.model,
          language: clientState.language,
        }, {signal: abortController.signal});

      const duration = Date.now() - start;
      console.log(`OpenAI Transcription took ${duration} ms`);

      // Only log if the request wasn't aborted during processing
      if (!abortController.signal.aborted) {
        console.log(`Transcription Result:`, speechToTextResult.text,);
        // You could emit this back to the specific client if needed
        // Find the client socket via memberId if necessary and emit
      } else {
        console.log(`Transcription aborted before completion.`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`OpenAI request aborted successfully.`);
      } else {
        console.error(`Error during transcription processing:`, error?.message || error,);
        if (error.response) {
          console.error('OpenAI API Error Details:', error.response.data,);
        }
      }
    } finally {
      // Clean up regardless of success or failure
      if (clientState) {
        clientState.isProcessing = false; // Reset processing flag
        clientState.abortController = null; // Clear the abort controller reference
      }
    }
  }

  // Function called by the gateway to stop transcription for a member
  async stopTranscription(memberId: string | number): Promise<void> {
    console.log(`Received stop transcription request.`);
    const clientState = this.clientStates.get(memberId);

    if (clientState) {
      if (clientState.intervalId) {
        clearInterval(clientState.intervalId);
        clientState.intervalId = null;
        console.log(`Processing interval stopped.`);
      }

      if (clientState.abortController) {
        console.log(`Aborting potentially ongoing OpenAI request...`);
        clientState.abortController.abort();
        clientState.abortController = null; // Clear reference
      }

      // 3. Optionally process remaining buffer immediately (or discard)
      // Let's process the remainder here before fully cleaning up
      if (clientState.buffer.length > 0 && !clientState.isProcessing) {
        console.log(`Processing remaining audio buffer before stopping...`);
        await this.processBufferedAudio(memberId); // Wait for final processing
      } else if (clientState.isProcessing) {
        console.log(`Waiting for ongoing processing to finish or abort...`);
      }

      clientState.buffer = [];
      console.log(`Audio buffer cleared.`);

    } else {
      console.warn(`Received stop request for unknown or already stopped member.`,);
    }
  }

  // Centralized cleanup logic for a client
  private cleanupClient(memberId: string | number): void {
    const clientState = this.clientStates.get(memberId);
    if (clientState) {
      console.log(`Cleaning up resources for member: ${memberId}`);
      if (clientState.intervalId) {
        clearInterval(clientState.intervalId);
        clientState.intervalId = null;
      }
      if (clientState.abortController) {
        console.log(`Aborting ongoing OpenAI request during cleanup...`);
        clientState.abortController.abort();
        clientState.abortController = null;
      }
      clientState.buffer = [];
    }
  }
}
