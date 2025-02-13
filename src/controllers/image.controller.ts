import {Controller, Get, Post, Put, Delete, Param, Body, Res, HttpStatus, Query} from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';
import {ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery} from '@nestjs/swagger';
import {
    Conversation,
    CreateConversation,
    CreateMessage,
    GenerateAiImageRequest,
    GenerateAiImageResponse,
    GenerateAndReturnAiImageResponse,
    GetAutoCompleteSuggestionsRequest,
    Message, PagedImages,
    PollImageStatusResponse,
    Suggestion,
} from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';
import {AIImageService} from "../services/aiImage.service";
import {ImagesService} from "../services/images.service";

@ApiTags('Image')
@Controller('image')
export class ImageController {
    constructor(
        private readonly aiImageService: AIImageService,
        private readonly imagesService: ImagesService,
        private readonly authenticationService: AuthenticationService
    ) {}

    @ApiOperation({ summary: 'Poll the status of an ai image that is being created. Updates the db if image name is returned.' })
    @ApiParam({ name: 'promptId', type: 'string', required: true, })
    @ApiResponse({ status: 200, description: 'The image name', type: PollImageStatusResponse, })
    @ApiResponse({ status: 404, type: undefined })
    @Get('prompt/:promptId')
    async pollImageStatus(@Param('promptId') promptId: string) {
        console.log(`polling promptId: ${promptId}`);
        const memberId = this.authenticationService.getMemberId();
        // const result = await this.aiImageService.pollImageStatus(promptId);
        const result = await this.imagesService.pollImageStatusAndUpdateEntryInDb(memberId, promptId);
        return result;
    }

    @ApiOperation({ summary: 'Have ai generate an image.  Store entry in image table, so the image is returned from all images endpoint.' })
    @ApiBody({ description: 'Params to create the image.', type: GenerateAiImageRequest, })
    @ApiResponse({ status: 200, description: 'Prompt id to poll for image status, then get the image name.', type: GenerateAiImageResponse})
    @Post('generateAiImage')
    async generateAiImage(@Body() request: GenerateAiImageRequest) {
        const memberId = this.authenticationService.getMemberId();
        const {width, height, prompt, prefix} = request;
        const result = await this.imagesService.generateImageAndStoreInDb(memberId, width, height, prompt, prefix);
        return result;
    }

    @ApiOperation({ summary: 'Have AI generate an image and return it directly.  No db involved.' })
    @ApiBody({ description: 'Params to create the image.', type: GenerateAiImageRequest })
    @ApiResponse({status: 200, description: 'Returns the generated image directly', type: GenerateAndReturnAiImageResponse,})
    @Post('generateAndReturnImage')
    async generateAndReturnImage(@Body() request: GenerateAiImageRequest): Promise<GenerateAndReturnAiImageResponse> {
        const memberId = this.authenticationService.getMemberId();
        const { width, height, prompt, prefix } = request;
        const result = await this.aiImageService.generateAndReturnImage(width, height, prompt, prefix);
        return result;
    }

    @ApiOperation({ summary: 'Get paged images for the current member' })
    @ApiQuery({ name: 'pageNumber', type: 'number', required: true })
    @ApiQuery({ name: 'numberOfImagesPerPage', type: 'number', required: true })
    @ApiResponse({ status: 200, description: 'Paged list of images', type: PagedImages })
    @Get('paged')
    async getPagedImages(
        @Query('pageNumber') pageNumber: number,
        @Query('numberOfImagesPerPage') numberOfImagesPerPage: number
    ): Promise<PagedImages> {
        const memberId = this.authenticationService.getMemberId();
        return await this.imagesService.getPagedImagesForMember(memberId, pageNumber,numberOfImagesPerPage);
    }

    @ApiOperation({ summary: 'Delete an image' })
    @ApiParam({ name: 'imageFileName', type: 'string' })
    @ApiResponse({ status: 200, description: 'The image has been deleted' })
    @ApiResponse({ status: 404, description: 'Image not found' })
    @Delete(':imageFileName')
    async deleteImage(@Param('imageFileName') imageFileName: string): Promise<void> {
        const memberId = this.authenticationService.getMemberId();
        return this.imagesService.deleteImage(memberId, imageFileName);
    }
}
