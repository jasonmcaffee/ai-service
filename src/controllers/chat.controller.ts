import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthenticationService } from '../services/authentication.service';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private readonly authenticationService: AuthenticationService) {}

  @ApiOperation({ summary: 'Stream a message based on a prompt' })
  @ApiQuery({ name: 'prompt', type: String, description: 'The prompt to initiate the message stream' })
  @ApiQuery({ name: 'conversationId', type: String, required: false, description: 'Optional. The conversation to add the passed in prompt and llm response to.' })
  @ApiQuery({name: 'modelId', type: 'number', required: false, description: 'The id of the model to use.  If not passed, the default model will be used.'})
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
  async streamInference(@Query('prompt') prompt: string, @Query('conversationId') conversationId: string,
                        @Query('modelId') modelId: number) {
    console.log('got stream inference request: ', prompt, conversationId, modelId);
    const memberId = this.authenticationService.getMemberId();
    return this.chatService.streamInference(prompt, memberId, conversationId, modelId);
  }
}
