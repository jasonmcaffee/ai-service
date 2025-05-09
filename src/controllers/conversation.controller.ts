import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import {
  Conversation,
  CreateConversation,
  CreateMessage, GetAutoCompleteSuggestionsRequest,
  Message, Suggestion,
} from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';

@ApiTags('Conversation')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService, private readonly authenticationService: AuthenticationService) {}

  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiResponse({ status: 200, description: 'The conversation details', type: Conversation, })
  @ApiResponse({ status: 404, type: undefined })
  @Get('conversation/:conversationId')
  async getConversation(@Param('conversationId') conversationId: string) {
    const memberId = this.authenticationService.getMemberId();
    const result = await this.conversationService.getConversation(memberId, conversationId);
    // console.log('get conversation by id result is: ', result);
    return result;
  }

  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ description: 'The conversation to create', type: CreateConversation, })
  @ApiResponse({ status: 200, description: 'The conversation has been successfully created.', type: Conversation})
  @Post('conversation')
  async createConversation(@Body() conversation: CreateConversation) {
    const memberId = this.authenticationService.getMemberId();
    const result = await this.conversationService.createConversation(memberId, conversation);
    // console.log('server side response object: ', result);
    return result;
  }

  @ApiOperation({ summary: 'Update an existing conversation' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiBody({ description: 'The updated conversation object', type: Conversation, })
  @ApiResponse({ status: 200, description: 'The conversation has been successfully updated.', })
  @Put('conversation/:conversationId')
  updateConversation(@Param('conversationId') conversationId: string, @Body() conversation: Conversation) {
    const memberId = this.authenticationService.getMemberId();
    return this.conversationService.updateConversation(memberId, conversationId, conversation);
  }

  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiResponse({ status: 200, description: 'The conversation has been successfully deleted.', })
  @Delete('conversation/:conversationId')
  deleteConversation(@Param('conversationId') conversationId: string) {
    const memberId = this.authenticationService.getMemberId();
    return this.conversationService.deleteConversation(memberId, conversationId);
  }

  @ApiOperation({ summary: 'Add a message to a conversation' })
  @ApiParam({ name: 'conversationId', type: 'string', required: true, })
  @ApiResponse({ status: 200, description: 'The message was successfully added', type: Message, })
  @Post(':conversationId/messages/message')
  async addMessage(@Param('conversationId') conversationId: string, @Body() message: CreateMessage,) {
    const memberId = this.authenticationService.getMemberId();
    return await this.conversationService.addMessageToConversation(memberId, conversationId, message);
  }

  @ApiOperation({summary: 'get all conversations for a member'})
  @ApiResponse({ status: 200, description: 'The conversation has been successfully deleted.', type: [Conversation]})
  @Get('conversations/member')
  async getConversationsForMember(){
    const memberId = this.authenticationService.getMemberId();
    const result = await this.conversationService.getConversationsForMember(memberId);
    return result;
  }

  @ApiOperation({summary: 'Have ai name the conversation'})
  @Post('conversation-name/:conversationId/nameConversation')
  @ApiParam({name: 'conversationId', type: 'string'})
  @ApiResponse({ status: 200, description: 'Updated conversation.', type: Conversation})
  // @ApiBody({ type: 'string', required: false })
  async nameConversation(@Param('conversationId') conversationId: string){
    console.log(`have ai name the conversation called.`);
    const memberId = this.authenticationService.getMemberId();
    const result = await this.conversationService.haveAiNameTheConversation(memberId, conversationId);
    console.log(`have ai name the conversation result: `, result);
    return result;
  }


  @ApiOperation({summary: 'Get auto complete suggestions based on partial text match.'})
  @Post('/getAutoCompleteSuggestions')
  @ApiBody({type: GetAutoCompleteSuggestionsRequest})
  @ApiResponse({status: 200, type: [Suggestion]})
  async getAtAutoCompleteSuggestions(@Body() request: GetAutoCompleteSuggestionsRequest){
    const memberId = this.authenticationService.getMemberId();
    const text = request.text;
    return await this.conversationService.getAtAutoCompleteSuggestions(memberId, text);
  }

}
