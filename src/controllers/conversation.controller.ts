import { Controller, Get, Param } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';

import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Conversation } from '../models/api/conversationApiModels';

@ApiTags('Conversation')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @ApiOperation({ summary: 'conversation' })
  @ApiParam({
    name: 'conversationId',
    type: 'string',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'The conversation details',
    type: Conversation, // Ensure this is pointing to the Conversation class
  })
  @Get(':conversationId')
  getConversation(@Param('conversationId') conversationId: string) {
    return this.conversationService.getConversation(conversationId);
  }
}
