import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OpenAI } from 'openai';
import { Readable } from 'stream';
import { AuthenticationService } from './authentication.service';

interface ClientState {
  buffer: Buffer[];
  intervalId: NodeJS.Timeout | null;
  isProcessing: boolean;
  abortController: AbortController | null;
  model: string;
  language?: string;
  clientId: string; // Store client id for potential logging/debugging
}

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

  handleClientConnection(
    memberId: string | number,
    clientId: string,
    model: string,
    language?: string,
  ): void {
    console.log(
      `Client connected: MemberId=${memberId}, ClientId=${clientId}, Model=${model}, Language=${language || 'auto'}`,
    );
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
      model: model || 'whisper-1', // Default model if not provided
      language: language,
      clientId: clientId,
    });
  }

  handleClientDisconnect(memberId: string | number): void {
    console.log(`Client disconnected: MemberId=${memberId}`);
    this.cleanupClient(memberId);
    this.clientStates.delete(memberId);
  }

  addAudioChunk(memberId: string | number, chunk: Buffer): void {
    const clientState = this.clientStates.get(memberId);
    if (!clientState) {
      console.warn(
        `Received chunk for unknown or disconnected member: ${memberId}`,
      );
      return;
    }

    clientState.buffer.push(chunk);

    // Start processing interval if not already started for this member
    if (!clientState.intervalId) {
      console.log(`Starting processing interval for member: ${memberId}`);
      // Use arrow function to maintain 'this' context
      clientState.intervalId = setInterval(
        () => this.processBufferedAudio(memberId),
        1000,
      ); // Process every 1 second
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
      // No audio data in the buffer for this interval
      return;
    }

    clientState.isProcessing = true; // Set processing flag
    const combinedBuffer = Buffer.concat(audioChunks);
    console.log(
      `[${memberId}] Processing ${combinedBuffer.length} bytes of audio`,
    );

    // Create an AbortController for this specific API call
    const abortController = new AbortController();
    clientState.abortController = abortController; // Store it to allow cancellation

    try {
      // Create a Readable stream from the Buffer in memory
      const audioStream = Readable.from(combinedBuffer);

      // Prepare the file argument for OpenAI
      // We need to provide a filename, even if arbitrary, for the API
      const fileArgument = {
        file: audioStream,
        filename: 'audio.wav', // Assume WAV or let Whisper auto-detect. Adjust if needed.
      };

      console.log(
        `[${memberId}] Sending to OpenAI (Model: ${clientState.model}, Lang: ${clientState.language || 'auto'})...`,
      );
      const start = Date.now();

      const speechToTextResult = await this.openAi.audio.transcriptions.create(
        {
          // @ts-ignore - Pass the stream/filename object
          file: fileArgument,
          model: clientState.model,
          language: clientState.language, // Pass language if provided
          // response_format: "text" // Optional: Get plain text directly
        },
        {
          signal: abortController.signal, // Pass the abort signal
        },
      );

      const duration = Date.now() - start;
      console.log(`[${memberId}] OpenAI Transcription took ${duration}ms`);

      // Only log if the request wasn't aborted during processing
      if (!abortController.signal.aborted) {
        console.log(
          `[${memberId}] Transcription Result:`,
          speechToTextResult.text,
        );
        // You could emit this back to the specific client if needed
        // Find the client socket via memberId if necessary and emit
      } else {
        console.log(`[${memberId}] Transcription aborted before completion.`);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[${memberId}] OpenAI request aborted successfully.`);
      } else {
        console.error(
          `[${memberId}] Error during transcription processing:`,
          error?.message || error,
        );
        if (error.response) {
          console.error(
            '[${memberId}] OpenAI API Error Details:',
            error.response.data,
          );
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
    console.log(`[${memberId}] Received stop transcription request.`);
    const clientState = this.clientStates.get(memberId);

    if (clientState) {
      // 1. Stop the interval timer
      if (clientState.intervalId) {
        clearInterval(clientState.intervalId);
        clientState.intervalId = null;
        console.log(`[${memberId}] Processing interval stopped.`);
      }

      // 2. Abort any ongoing OpenAI request
      if (clientState.abortController) {
        console.log(`[${memberId}] Aborting potentially ongoing OpenAI request...`);
        clientState.abortController.abort();
        clientState.abortController = null; // Clear reference
      }

      // 3. Optionally process remaining buffer immediately (or discard)
      // Let's process the remainder here before fully cleaning up
      if (clientState.buffer.length > 0 && !clientState.isProcessing) {
        console.log(`[${memberId}] Processing remaining audio buffer before stopping...`);
        await this.processBufferedAudio(memberId); // Wait for final processing
      } else if (clientState.isProcessing) {
        console.log(`[${memberId}] Waiting for ongoing processing to finish or abort...`);
        // Abort called above should handle this.
      }


      // 4. Clear the buffer
      clientState.buffer = [];
      console.log(`[${memberId}] Audio buffer cleared.`);

      // Note: We don't delete the state from the map here,
      // disconnect handler or a new connection will manage that.
      // If 'stop' means 'disconnect', then call cleanupClient and delete.
      // Assuming 'stop' just means stop *sending* audio for now.

    } else {
      console.warn(
        `[${memberId}] Received stop request for unknown or already stopped member.`,
      );
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
        console.log(`[${memberId}] Aborting ongoing OpenAI request during cleanup...`);
        clientState.abortController.abort();
        clientState.abortController = null;
      }
      clientState.buffer = []; // Clear buffer immediately
      // Don't delete from map here, calling function handles that
    }
  }
}
