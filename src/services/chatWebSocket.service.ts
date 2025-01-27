import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ChatInference } from '../models/api/conversationApiModels';
import { Controller } from '@nestjs/common';

//doesn't work
@WebSocketGateway({ namespace: 'chat2' })
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('inference')
  async handleInference(@MessageBody() chatInference: ChatInference, client: Socket): Promise<void> {
    console.log('handleInference websocket called: ', chatInference);
    try {
      const observable = await this.chatService.streamInference(chatInference.prompt);

      observable.subscribe({
        next: (chunk) => {
          client.emit('response', { text: chunk });
        },
        error: (err) => {
          client.emit('error', { error: err.message });
        },
        complete: () => {
          client.emit('disconnect');
        },
      });
    } catch (error) {
      client.emit('error', { error: error.message });
    }
  }
}
