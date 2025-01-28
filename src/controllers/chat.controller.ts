import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ChatInference } from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private readonly authenticationService: AuthenticationService) {}

  @ApiOperation({ summary: 'Stream a message based on a prompt' })
  @ApiQuery({ name: 'prompt', type: String, description: 'The prompt to initiate the message stream' })
  @ApiQuery({ name: 'conversationId', type: String, description: 'Optional. The conversation to add the passed in prompt and llm response to.' })
  @Get('streamInference') // Must be GET for EventSource to work
  @Sse() // Server-Sent Events so we can stream LLM response back the client.
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: { "text": "response", "end": "true" }', //end is true when response is complete.
        },
      },
    },
  })
  async streamInference(@Query('prompt') prompt: string, @Query('conversationId') conversationId: string) {
    console.log('got stream inference request: ', prompt, conversationId);
    const memberId = this.authenticationService.getMemberId();
    return this.chatService.streamInference(prompt, memberId, conversationId);
  }

  // @ApiOperation({ summary: 'Inference based on a prompt' })
  // @ApiBody({ description: 'Prompt', type: ChatInference })
  // @Post('inference')
  // @Sse()
  // async inference(@Body() chatInference: ChatInference) {
  //   const memberId = "1";
  //   return this.chatService.streamInference(chatInference.prompt, memberId);
  // }
}
