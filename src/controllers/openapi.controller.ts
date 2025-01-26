import { Controller, Get, Param } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';

import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@Controller('openapi')
export class OpenApiController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  getOpenApiSpec() {

  }
}
