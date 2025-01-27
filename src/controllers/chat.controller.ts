import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ChatInference } from '../models/api/conversationApiModels';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Stream a message based on a prompt' })
  @ApiQuery({ name: 'prompt', type: String, description: 'The prompt to initiate the message stream' })
  @Get('streamInference') // Must be GET for EventSource to work
  @Sse() // Server-Sent Events
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: { "message": "response" }\n\n',
        },
      },
    },
  })
  async streamInference(@Query('prompt') prompt: string) {
    console.log('got stream inference request: ', prompt);
    return this.chatService.streamInference(prompt);
  }

  @ApiOperation({ summary: 'Inference based on a prompt' })
  @ApiBody({ description: 'Prompt', type: ChatInference })
  @Post('inference')
  @Sse()
  async inference(@Body() chatInference: ChatInference) {
    return this.chatService.streamInference(chatInference.prompt);
  }
}
