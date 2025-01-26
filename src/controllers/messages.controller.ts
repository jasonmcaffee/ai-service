import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Message } from '../models/api/conversationApiModels';
import { MessagesService } from '../services/messages.service';

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}
  //
  // @ApiOperation({ summary: 'Get a message by ID' })
  // @ApiParam({
  //   name: 'messageId',
  //   type: 'string',
  //   required: true,
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'The message details',
  //   type: Message,
  // })
  // @Get(':messageId')
  // getMessage(@Param('messageId') messageId: string) {
  //   return this.messagesService.getMessage(messageId);
  // }
  //
  // @ApiOperation({ summary: 'Get all messages for a conversation' })
  // @ApiParam({
  //   name: 'conversationId',
  //   type: 'string',
  //   required: true,
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'The messages for the conversation',
  //   type: [Message],
  // })
  // @Get('conversation/:conversationId')
  // getMessagesForConversation(@Param('conversationId') conversationId: string) {
  //   return this.messagesService.getMessagesForConversation(conversationId);
  // }
  //
  // @ApiOperation({ summary: 'Create a new message' })
  // @ApiResponse({
  //   status: 201,
  //   description: 'The created message',
  //   type: Message,
  // })
  // @Post()
  // createMessage(@Body() message: Message) {
  //   return this.messagesService.createMessage(message);
  // }
  //
  // @ApiOperation({ summary: 'Update a message by ID' })
  // @ApiParam({
  //   name: 'messageId',
  //   type: 'string',
  //   required: true,
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'The updated message',
  //   type: Message,
  // })
  // @Put(':messageId')
  // updateMessage(@Param('messageId') messageId: string, @Body() message: Message) {
  //   return this.messagesService.updateMessage(messageId, message);
  // }
  //
  // @ApiOperation({ summary: 'Delete a message by ID' })
  // @ApiParam({
  //   name: 'messageId',
  //   type: 'string',
  //   required: true,
  // })
  // @ApiResponse({
  //   status: 204,
  //   description: 'Message successfully deleted',
  // })
  // @Delete(':messageId')
  // deleteMessage(@Param('messageId') messageId: string) {
  //   return this.messagesService.deleteMessage(messageId);
  // }
}
