import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OpenAI, toFile } from 'openai';
import { Socket } from 'socket.io';
import { AuthenticationService } from './authentication.service';

interface ClientState {
  isProcessing: boolean;
  abortController: AbortController | null;
  model: string;
  language?: string;
  clientId: string;
  socket: Socket; // Added to emit transcription back to the client
}

@Injectable()
export class SpeechToTextService implements OnModuleDestroy {
  private readonly openAi: OpenAI;
  private readonly clientStates = new Map<string | number, ClientState>();

  constructor(private readonly authenticationService: AuthenticationService) {
    this.openAi = new OpenAI({
      baseURL: 'http://192.168.0.209:8000/v1',
      apiKey: 'na',
      timeout: 30 * 1000,
    });
    console.log('SpeechToTextService initialized with OpenAI baseURL:', this.openAi.baseURL);
  }

  onModuleDestroy() {
    console.log('Cleaning up client states on module destroy...');
    const memberIds = Array.from(this.clientStates.keys());
    memberIds.forEach((memberId) => this.cleanupClient(memberId));
    this.clientStates.clear();
    console.log('Client states cleared.');
  }

  handleClientConnection(
    memberId: string,
    clientId: string,
    model: string,
    language: string | undefined,
    socket: Socket, // Pass the socket instance
  ): void {
    console.log(`Client connected: MemberId=${memberId}, ClientId=${clientId}, Model=${model}, Language=${language || 'auto'}`);
    if (this.clientStates.has(memberId)) {
      console.warn(`Member ${memberId} already has an active connection. Cleaning up old one.`);
      this.cleanupClient(memberId);
    }
    this.clientStates.set(memberId, {
      isProcessing: false,
      abortController: null,
      model,
      language,
      clientId,
      socket, // Store socket for emitting results
    });
  }

  handleClientDisconnect(memberId: string | number): void {
    console.log(`Client disconnected: MemberId=${memberId}`);
    this.cleanupClient(memberId);
    this.clientStates.delete(memberId);
  }

  async handleAudioChunk(memberId: string, chunk: Buffer): Promise<void> {
    const clientState = this.clientStates.get(memberId);
    if (!clientState) {
      console.warn(`Received chunk for unknown or disconnected member: ${memberId}`);
      return;
    }

    if (clientState.isProcessing) {
      console.log(`Skipping chunk for ${memberId} as processing is ongoing`);
      return;
    }

    clientState.isProcessing = true;
    const abortController = new AbortController();
    clientState.abortController = abortController;

    try {
      const fileArgument = await toFile(chunk, `audio-${Date.now()}.webm`, { type: 'audio/webm' });
      console.log(`Sending WebM chunk to OpenAI (Model: ${clientState.model}, Lang: ${clientState.language})...`);
      const start = Date.now();
      const speechToTextResult = await this.openAi.audio.transcriptions.create({
        file: fileArgument,
        model: clientState.model,
        language: clientState.language,
      }, { signal: abortController.signal });

      const duration = Date.now() - start;
      console.log(`OpenAI Transcription took ${duration} ms`);

      if (!abortController.signal.aborted) {
        console.log(`Transcription Result:`, speechToTextResult.text);
        clientState.socket.emit('transcriptionResult', speechToTextResult.text); // Emit to client
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`OpenAI request aborted successfully.`);
      } else {
        console.error(`Error during transcription:`, error?.message || error);
        clientState.socket.emit('transcriptionError', error?.message || 'Transcription failed');
      }
    } finally {
      clientState.isProcessing = false;
      clientState.abortController = null;
    }
  }

  async stopTranscription(memberId: string | number): Promise<void> {
    console.log(`Received stop transcription request for ${memberId}`);
    const clientState = this.clientStates.get(memberId);

    if (clientState && clientState.abortController) {
      console.log(`Aborting ongoing OpenAI request...`);
      clientState.abortController.abort();
      clientState.abortController = null;
      clientState.socket.emit('stoppedTranscription', 'Transcription stopped');
    }
  }

  private cleanupClient(memberId: string | number): void {
    const clientState = this.clientStates.get(memberId);
    if (clientState) {
      console.log(`Cleaning up resources for member: ${memberId}`);
      if (clientState.abortController) {
        clientState.abortController.abort();
        clientState.abortController = null;
      }
    }
  }
}
