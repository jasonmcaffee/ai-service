import { Controller, Get, Post, Put, Delete, Param, Body, Query, Res, Sse } from '@nestjs/common';
import { ModelsService } from '../services/models.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Model, CreateModel, UpdateModel, ModelType, HFModel } from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';
import { Response } from 'express';

@ApiTags('Models')
@Controller('models')
export class ModelsController {
    constructor(
      private readonly modelsService: ModelsService,
      private readonly authenticationService: AuthenticationService
    ) {}

    @ApiOperation({ summary: 'Search for models on HuggingFace' })
    @ApiQuery({ name: 'query', type: 'string', required: true, description: 'Search query' })
    @ApiResponse({ status: 200, description: 'List of models from HuggingFace', type: [HFModel] })
    @Get('huggingface/search')
    async searchModelsOnHuggingFace(@Query('query') query: string) {
        return this.modelsService.searchModelsOnHuggingFace(query);
    }

    @ApiOperation({ summary: 'Download a file from a HuggingFace model' })
    @ApiParam({ name: 'modelId', type: 'string', required: true, description: 'HuggingFace model ID' })
    @ApiParam({ name: 'filename', type: 'string', required: true, description: 'File name to download' })
    @ApiResponse({ status: 202, description: 'Download started' })
    @Post('huggingface/:modelId/download/:filename')
    async downloadFileFromHuggingFaceModel(
      @Param('modelId') modelId: string,
      @Param('filename') filename: string,
      @Res() res: Response
    ) {
        const memberId = this.authenticationService.getMemberId();
        // Start the download but don't wait for it to complete
        this.modelsService.downloadFileFromHuggingFaceModel(memberId, modelId, filename)
          .catch(error => console.error(`Error in download process: ${error.message}`));

        // Return success immediately
        return res.status(202).json({ message: `Download of ${filename} started` });
    }

    @ApiOperation({ summary: 'Download a file from a HuggingFace model with progress updates via SSE' })
    @ApiParam({ name: 'modelId', type: 'string', required: true, description: 'HuggingFace model ID' })
    @ApiParam({ name: 'filename', type: 'string', required: true, description: 'File name to download' })
    @ApiResponse({ status: 200, description: 'SSE connection established for download progress' })
    @Get('huggingface/:modelId/download-progress/:filename') // Must be GET for EventSource to work
    @Sse()
    async downloadFileWithProgressUpdates(
      @Param('modelId') modelId: string,
      @Param('filename') filename: string
    ) {
        const memberId = this.authenticationService.getMemberId();
        // Create SSE subject for this download
        const downloadSSE = this.modelsService.createDownloadStreamForFile(memberId, modelId, filename);
        // Start the download process in the background
        this.modelsService.downloadFileFromHuggingFaceModelStreamDownloadProgress(memberId, modelId, filename, downloadSSE);

        // Return the SSE subject for streaming
        return downloadSSE.getSubject();
    }

    @ApiOperation({ summary: 'Stop downloading a file from HuggingFace model' })
    @ApiParam({ name: 'filename', type: 'string', required: true, description: 'File name to stop downloading' })
    @ApiResponse({ status: 200, description: 'Download canceled or not found' })
    @Delete('huggingface/download/:filename')
    async stopDownloadingHuggingFaceModelFile(
      @Param('filename') filename: string
    ) {
        const memberId = this.authenticationService.getMemberId();
        const wasCanceled = await this.modelsService.stopDownloadingHuggingFaceModelFile(memberId, filename);
        return { canceled: wasCanceled };
    }

    @ApiOperation({ summary: 'Get all model types' })
    @ApiResponse({ status: 200, description: 'List of model types', type: [ModelType] })
    @Get('model-types')
    async getModelTypes() {
        return this.modelsService.getModelTypes();
    }

    @ApiOperation({ summary: 'Get model by ID' })
    @ApiParam({ name: 'modelId', type: 'string', required: true })
    @ApiResponse({ status: 200, description: 'The model details', type: Model })
    @ApiResponse({ status: 404, type: undefined })
    @Get(':modelId')
    async getModelById(@Param('modelId') modelId: string) {
        const memberId = this.authenticationService.getMemberId();
        return this.modelsService.getModelById(memberId, modelId);
    }

    @ApiOperation({ summary: 'Get all models for the authenticated member' })
    @ApiResponse({ status: 200, description: 'List of models', type: [Model] })
    @Get()
    async getAllModelsForMember() {
        const memberId = this.authenticationService.getMemberId();
        return this.modelsService.getAllModelsForMember(memberId);
    }

    @ApiOperation({ summary: 'Create a new model' })
    @ApiBody({ description: 'The model to create', type: CreateModel })
    @ApiResponse({ status: 201, description: 'The model has been successfully created.', type: Model })
    @Post()
    async createModel(@Body() model: CreateModel) {
        const memberId = this.authenticationService.getMemberId();
        return this.modelsService.createModel(memberId, model);
    }

    @ApiOperation({ summary: 'Update an existing model' })
    @ApiParam({ name: 'modelId', type: 'string', required: true })
    @ApiBody({ description: 'The updated model object', type: UpdateModel })
    @ApiResponse({ status: 200, description: 'The model has been successfully updated.', type: Model })
    @Put(':modelId')
    async updateModel(@Param('modelId') modelId: string, @Body() model: UpdateModel) {
        const memberId = this.authenticationService.getMemberId();
        return this.modelsService.updateModel(memberId, modelId, model);
    }

    @ApiOperation({ summary: 'Delete a model' })
    @ApiParam({ name: 'modelId', type: 'string', required: true })
    @ApiResponse({ status: 200, description: 'The model has been successfully deleted.' })
    @Delete(':modelId')
    async deleteModel(@Param('modelId') modelId: string) {
        const memberId = this.authenticationService.getMemberId();
        return this.modelsService.deleteModel(memberId, modelId);
    }
}
