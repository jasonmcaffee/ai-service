import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthenticationService } from '../services/authentication.service';
import {
  AiStatusUpdate,
  StatusTopicKeyValues,
  StatusTopicKeyValuesResponse,
} from '../models/api/conversationApiModels';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private readonly authenticationService: AuthenticationService) {}

  @ApiOperation({ summary: 'Stream a message based on a prompt' })
  @ApiQuery({ name: 'prompt', type: String, description: 'The prompt to initiate the message stream' })
  @ApiQuery({ name: 'conversationId', type: String, required: false, description: 'Optional. The conversation to add the passed in prompt and llm response to.' })
  @ApiQuery({name: 'modelId', type: String, required: false, description: 'The id of the model to use.  If not passed, the default model will be used.'})
  @ApiQuery({name: 'shouldSearchWeb', type: Boolean, required: true, description: 'Indicator on whether to search the web.'})
  @ApiQuery({name: 'shouldUsePlanTool', type: Boolean, required: true, description: 'Indicator on whether to preplan execution'})
  @ApiQuery({name: 'shouldRespondWithAudio', type: Boolean, required: true, description: 'Indicator on whether audio should be streamed along with text.'})
  @ApiQuery({name: 'textToSpeechSpeed', type: Number, required: true, description: 'How fast the speech should be'})
  @ApiQuery({name: 'shouldUseAgentOfAgents', type: Boolean, required: true, description: 'Should use agent to coordinate other agents'})

  @Get('streamInference') // Must be GET for EventSource to work
  @Sse() // Server-Sent Events so we can stream LLM response back the client.
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: { "text": "response", "end": "true", status: {title: "", content: ""} }', //end is true when response is complete.
        },
      },
    },
  })
  async streamInference(@Query('prompt') prompt: string, @Query('conversationId') conversationId: string,
                      @Query('modelId') modelId: string, @Query('shouldSearchWeb') shouldSearchWeb: boolean,
                        @Query('shouldUsePlanTool') shouldUsePlanTool: boolean,
                        @Query('shouldRespondWithAudio') shouldRespondWithAudio: boolean,
                        @Query('textToSpeechSpeed') textToSpeechSpeed: number,
                        @Query('shouldUseAgentOfAgents') shouldUseAgentOfAgents: boolean,
  ) {
    console.log('got stream inference request: ', prompt, conversationId, modelId);
    const memberId = this.authenticationService.getMemberId();
    if(typeof shouldSearchWeb === "string"){
      shouldSearchWeb = shouldSearchWeb === "true";
    }
    if(typeof shouldUsePlanTool === "string"){
      shouldUsePlanTool = shouldUsePlanTool === "true";
    }
    if(typeof shouldRespondWithAudio === "string"){
      shouldRespondWithAudio = shouldRespondWithAudio === "true";
    }
    if(typeof textToSpeechSpeed === "string"){
      textToSpeechSpeed = parseFloat(textToSpeechSpeed);
    }
    if(typeof shouldUseAgentOfAgents === "string"){
      shouldUseAgentOfAgents = shouldUseAgentOfAgents === "true";
    }
    return this.chatService.streamInference(prompt, memberId, conversationId, modelId, shouldSearchWeb, shouldUsePlanTool, shouldRespondWithAudio, textToSpeechSpeed, shouldUseAgentOfAgents);
  }

  @ApiOperation({summary: 'stop the current stream for a member'})
  @Get('stop')
  @ApiResponse({status: 201})
  async stop(){
    const memberId = this.authenticationService.getMemberId();
    return this.chatService.stop(memberId);
  }

  @ApiOperation({summary: 'get statuses'})
  @Get('aiStatusUpdates')
  @ApiResponse({ status: 200, type: [AiStatusUpdate]})
  async getStatusUpdates(){
    return [];
  }

  @ApiOperation({summary: 'get status topic map'})
  @Get('statusTopicMap')
  @ApiResponse({ status: 200, type: StatusTopicKeyValuesResponse})
  async getStatusTopicMap(){
    return [];
  }

}
