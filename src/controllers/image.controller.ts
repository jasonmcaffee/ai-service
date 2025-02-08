import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import {
    Conversation,
    CreateConversation,
    CreateMessage, GenerateAiImageRequest, GenerateAiImageResponse, GetAutoCompleteSuggestionsRequest,
    Message, PollImageStatusResponse, Suggestion,
} from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';
import {AIImageService} from "../services/aiImage.service";

@ApiTags('Image')
@Controller('image')
export class ImageController {
    constructor(private readonly aiImageService: AIImageService, private readonly authenticationService: AuthenticationService) {}

    @ApiOperation({ summary: 'Poll the status of an ai image that is being created.' })
    @ApiParam({ name: 'promptId', type: 'string', required: true, })
    @ApiResponse({ status: 200, description: 'The image name', type: PollImageStatusResponse, })
    @ApiResponse({ status: 404, type: undefined })
    @Get('prompt/:promptId')
    async pollImageStatus(@Param('promptId') promptId: string) {
        const memberId = this.authenticationService.getMemberId();
        const result = await this.aiImageService.pollImageStatus(promptId);
        return result;
    }

    @ApiOperation({ summary: 'Have ai generate an image' })
    @ApiBody({ description: 'Params to create the image.', type: GenerateAiImageRequest, })
    @ApiResponse({ status: 200, description: 'Prompt id to poll for image status, then get the image name.', type: GenerateAiImageResponse})
    @Post('conversation')
    async createConversation(@Body() request: GenerateAiImageRequest) {
        const memberId = this.authenticationService.getMemberId();
        const {width, height, prompt, prefix} = request;
        const result = await this.aiImageService.generateImage(width, height, prompt, prefix);
        return result;
    }

}
