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
import { ChatService } from '../services/chat.service';
import { AuthenticationService } from '../services/authentication.service';
import { StreamInferenceRequest } from '../client/api-client';

/**
 * WebSocket Gateway for chat functionality that mirrors the SSE streamInference endpoint
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Adjust for production!
  },
  // namespace: ['/chat', '/'], // Allow both /chat namespace and root namespace
  path: '/socket.io', // Use the default Socket.io path
  maxHttpBufferSize: 10e6,
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  // Map clientId to memberId for easy lookup on disconnect
  private clientMemberMap = new Map<string, string>();

  constructor(
    private readonly chatService: ChatService,
    private readonly authenticationService: AuthenticationService,
  ) {
    console.log(`Chat Gateway initialized ============================ `);
  }

  @WebSocketServer() server: Server;

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    console.log(`Chat client attempting connection: ${client.id}`);
    try {
      // --- Authentication and Configuration ---
      const memberId = this.authenticationService.getMemberId();

      // Store mapping for disconnect
      this.clientMemberMap.set(client.id, memberId);

      client.emit('connectionSuccess', { memberId: memberId, clientId: client.id });

    } catch (error) {
      console.error(`Error during chat client connection ${client.id}:`, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    console.log(`Chat client disconnected: ${client.id}`);
    this.clientMemberMap.delete(client.id); // Clean up map
  }

  @SubscribeMessage('streamInference')
  async handleStreamInference(
    @MessageBody() data: StreamInferenceRequest,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const memberId = this.clientMemberMap.get(client.id);

    if (memberId === undefined) {
      console.warn(`Received 'streamInference' from unknown client: ${client.id}`);
      client.emit('error', 'Authentication required');
      return;
    }

    try {
      console.log(`WebSocket streamInference request from client ${client.id}:`, data);

      // Validate required parameters
      if (!data.prompt) {
        client.emit('error', 'Prompt is required');
        return;
      }

      // Handle parameter type conversion (similar to SSE controller)
      let shouldSearchWeb = data.shouldSearchWeb;
      let shouldUsePlanTool = data.shouldUsePlanTool;
      let shouldRespondWithAudio = data.shouldRespondWithAudio;
      let textToSpeechSpeed = data.textToSpeechSpeed;
      let shouldUseAgentOfAgents = data.shouldUseAgentOfAgents;
      let temperature = data.temperature;
      let top_p = data.topP;
      let frequency_penalty = data.frequencyPenalty;
      let presence_penalty = data.presencePenalty;

      if (typeof shouldSearchWeb === "string") {
        shouldSearchWeb = shouldSearchWeb === "true";
      }
      if (typeof shouldUsePlanTool === "string") {
        shouldUsePlanTool = shouldUsePlanTool === "true";
      }
      if (typeof shouldRespondWithAudio === "string") {
        shouldRespondWithAudio = shouldRespondWithAudio === "true";
      }
      if (typeof textToSpeechSpeed === "string") {
        textToSpeechSpeed = parseFloat(textToSpeechSpeed);
      }
      if (typeof shouldUseAgentOfAgents === "string") {
        shouldUseAgentOfAgents = shouldUseAgentOfAgents === "true";
      }
      if (typeof temperature === "string") {
        temperature = parseFloat(temperature);
      }
      if (typeof top_p === "string") {
        top_p = parseFloat(top_p);
      }
      if (typeof frequency_penalty === "string") {
        frequency_penalty = parseFloat(frequency_penalty);
      }
      if (typeof presence_penalty === "string") {
        presence_penalty = parseFloat(presence_penalty);
      }
      // Call the existing chat service with the same parameters as SSE
      const observable = await this.chatService.streamInference(
        data.prompt,
        memberId,
        data.conversationId || '',
        data.modelId,
        shouldSearchWeb,
        shouldUsePlanTool,
        shouldRespondWithAudio,
        textToSpeechSpeed,
        shouldUseAgentOfAgents,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        data.imageUrl
      );

      // Subscribe to the observable and forward messages to WebSocket client
      const subscription = observable.subscribe({
        next: (message: string) => {
          // The message is already formatted as JSON string, just emit it
          client.emit('message', message);
        },
        error: (error: any) => {
          console.error('WebSocket streamInference error:', error);
          client.emit('error', error.message || 'An error occurred during streaming');
          subscription.unsubscribe();
        },
        complete: () => {
          console.log('WebSocket streamInference completed for client:', client.id);
          subscription.unsubscribe();
        }
      });

      // Handle client disconnect to clean up subscription
      client.on('disconnect', () => {
        subscription.unsubscribe();
      });

    } catch (error) {
      console.error('Error in WebSocket streamInference:', error);
      client.emit('error', error.message || 'An error occurred');
    }
  }
} 