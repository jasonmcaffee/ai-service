import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { Conversation, CreateConversation, CreateMessage, Message } from '../models/api/conversationApiModels';

@ApiTags('Conversation')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiResponse({ status: 200, description: 'The conversation details', type: Conversation, })
  @ApiResponse({ status: 404, type: undefined })
  @Get(':conversationId')
  async getConversation(@Param('conversationId') conversationId: string) {
    const memberId = "1";
    const result = await this.conversationService.getConversation(memberId, conversationId);
    console.log('result is: ', result);
    return result;
  }

  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ description: 'The conversation to create', type: CreateConversation, })
  @ApiResponse({ status: 200, description: 'The conversation has been successfully created.', type: Conversation})
  @Post()
  async createConversation(@Body() conversation: CreateConversation) {
    const memberId = "1";
    const result = await this.conversationService.createConversation(memberId, conversation);
    console.log('server side response object: ', result);
    return result;
  }

  @ApiOperation({ summary: 'Update an existing conversation' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiBody({ description: 'The updated conversation object', type: Conversation, })
  @ApiResponse({ status: 200, description: 'The conversation has been successfully updated.', })
  @Put(':conversationId')
  updateConversation(@Param('conversationId') conversationId: string, @Body() conversation: Conversation) {
    const memberId = "1";
    return this.conversationService.updateConversation(memberId, conversationId, conversation);
  }

  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiResponse({ status: 200, description: 'The conversation has been successfully deleted.', })
  @Delete(':conversationId')
  deleteConversation(@Param('conversationId') conversationId: string) {
    const memberId = "1";
    return this.conversationService.deleteConversation(memberId, conversationId);
  }

  @ApiOperation({ summary: 'Add a message to a conversation' })
  @ApiParam({
    name: 'conversationId',
    type: 'string',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'The message was successfully added',
    type: Message, // Ensure this is pointing to the Message class
  })
  @Post(':conversationId/messages')
  addMessage(
    @Param('conversationId') conversationId: string,
    @Body() message: CreateMessage,
  ) {
    const memberId = "1";
    return this.conversationService.addMessageToConversation(memberId, conversationId, message);
  }
}
