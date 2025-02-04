import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ModelsService } from '../services/models.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import {Model, CreateModel, UpdateModel, ModelType} from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';

@ApiTags('Models')
@Controller('models')
export class ModelsController {
    constructor(
        private readonly modelsService: ModelsService,
        private readonly authenticationService: AuthenticationService
    ) {}

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
    async updateModel(@Param('modelId') modelId: string, @Body() model: Model) {
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
