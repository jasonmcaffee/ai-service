import { Controller, Post, Body, Sse } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ChatInference } from '../models/api/conversationApiModels';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Stream a message based on a prompt' })
  @ApiBody({ description: 'Prompt to initiate the message stream', type: ChatInference })
  @Post('streamInference')
  @Sse()  // Server-Sent Events
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          "$ref": "#/components/schemas/ChatInference"
        }
      }
    }
  })
  async streamInference(@Body() chatInference: ChatInference) {
    return this.chatService.streamInference(chatInference.prompt);
  }

  @ApiOperation({ summary: 'Inference based on a prompt' })
  @ApiBody({ description: 'Prompt', type: ChatInference })
  @Post('inference')
  async inference(@Body() chatInference: ChatInference) {
    // return this.chatService.streamInference(chatInference.prompt);
  }
}
