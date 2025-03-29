import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { SpeechToTextService } from '../services/speechToText.service';
import { AuthenticationService } from '../services/authentication.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust for production!
  },
  namespace: '/speechToText', // Define the namespace
  path: '/socket.io', // Use the default Socket.io path
  // path: '/speechToText', // Optional: Namespace your websocket endpoint
})
export class SpeechToTextGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  // Map clientId to memberId for easy lookup on disconnect
  private clientMemberMap = new Map<string, string | number>();

  // Inject your actual AuthenticationService and SpeechToTextService
  constructor(
    private readonly speechToTextService: SpeechToTextService,
    private readonly authenticationService: AuthenticationService,
  ) {
    console.log(`speech To Text Gateway ============================ `);
  }

  // Optional: Inject server instance if needed for broadcasting, etc.
  // @WebSocketServer() server: Server;

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    console.log(`Client attempting connection: ${client.id}`);
    try {
      // --- Authentication and Configuration ---
      const memberId = this.authenticationService.getMemberId();

      // --- Get Model and Language from Query Params ---
      const model = client.handshake.query.model as string;
      const language = client.handshake.query.language as string | undefined; // Optional

      if (!model) {
        console.warn(`Client ${client.id} (Member: ${memberId}) connected without specifying 'model' query parameter. Using default.`);
        // Allow connection with default model, or disconnect if model is mandatory:
        // client.disconnect(true);
        // return;
      }

      // Store mapping for disconnect
      this.clientMemberMap.set(client.id, memberId);

      // Notify the service
      this.speechToTextService.handleClientConnection(
        memberId,
        client.id, // Pass client.id too if service needs it
        model, // Pass retrieved model
        language, // Pass retrieved language
      );

      client.emit('connectionSuccess', { memberId: memberId, clientId: client.id }); // Optional ack

    } catch (error) {
      console.error(`Error during client connection ${client.id}:`, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
    const memberId = this.clientMemberMap.get(client.id);

    if (memberId !== undefined) {
      this.speechToTextService.handleClientDisconnect(memberId);
      this.clientMemberMap.delete(client.id); // Clean up map
    } else {
      console.warn(
        `Could not find memberId mapping for disconnected client: ${client.id}`,
      );
      // Potentially iterate service's clientStates if needed, though map should be reliable
    }
  }

  @SubscribeMessage('audioChunk')
  async handleAudioChunk(
    @MessageBody() data: any, // Expecting Buffer or ArrayBuffer
    @ConnectedSocket() client: Socket,
  ): Promise<void> { // Make async if getMemberId is async
    const memberId = this.clientMemberMap.get(client.id);

    if (memberId === undefined) {
      console.warn(`Received 'audioChunk' from unknown client: ${client.id}`);
      return; // Or disconnect the client
    }

    let buffer: Buffer;
    if (data instanceof Buffer) {
      buffer = data;
    } else if (data instanceof ArrayBuffer) {
      buffer = Buffer.from(data);
    } else if (Buffer.isBuffer(data)) { // Check if socket.io wrapped it
      buffer = data;
    } else {
      console.warn(
        `[${memberId}/${client.id}] Received non-buffer data on audioChunk: ${typeof data}`,
      );
      client.emit('transcriptionError', 'Invalid audio data format.'); // Send error back
      return;
    }

    // Forward to the service
    this.speechToTextService.addAudioChunk(memberId, buffer);
  }

  @SubscribeMessage('stopTranscription')
  async handleStopTranscription(
    @ConnectedSocket() client: Socket,
  ): Promise<void> { // Make async if service call is async
    const memberId = this.clientMemberMap.get(client.id);
    if (memberId !== undefined) {
      console.log(`Received 'stopTranscription' from Member: ${memberId}`);
      await this.speechToTextService.stopTranscription(memberId);
      client.emit('stoppedTranscription', { memberId }); // Acknowledge stop
    } else {
      console.warn(
        `Received 'stopTranscription' from unknown client: ${client.id}`,
      );
    }
  }
}
