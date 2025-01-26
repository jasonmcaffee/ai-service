import { Controller, Get, Param } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';

import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

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
  @Get(':conversationId')
  getConversation(@Param('conversationId') conversationId: string) {
    return this.conversationService.getConversation(conversationId);
  }
}
