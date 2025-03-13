import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { MemberPromptService } from '../services/memberPrompt.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { MemberPrompt, CreateMemberPrompt, UpdateMemberPrompt } from '../models/api/conversationApiModels';
import { AuthenticationService } from '../services/authentication.service';

@ApiTags('Member Prompts')
@Controller('prompts')
export class MemberPromptController {
  constructor(
    private readonly memberPromptService: MemberPromptService,
    private readonly authenticationService: AuthenticationService
  ) {}

  @ApiOperation({ summary: 'Create a new prompt for the current member' })
  @ApiBody({ type: CreateMemberPrompt })
  @ApiResponse({ status: 201, description: 'The prompt has been created', type: MemberPrompt })
  @Post()
  async createPrompt(@Body() createMemberPrompt: CreateMemberPrompt): Promise<MemberPrompt> {
    const memberId = this.authenticationService.getMemberId();
    return await this.memberPromptService.createPrompt(memberId, createMemberPrompt);
  }

  @ApiOperation({ summary: 'Get all prompts for the current member' })
  @ApiResponse({ status: 200, description: 'List of prompts for the member', type: [MemberPrompt] })
  @Get()
  async getPromptsForMember(): Promise<MemberPrompt[]> {
    const memberId = this.authenticationService.getMemberId();
    return await this.memberPromptService.getPromptsForMemberId(memberId);
  }

  @ApiOperation({ summary: 'Get a specific prompt by ID' })
  @ApiParam({ name: 'promptId', type: 'string' })
  @ApiResponse({ status: 200, description: 'The prompt details', type: MemberPrompt })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @Get(':promptId')
  async getPromptById(@Param('promptId') promptId: string): Promise<MemberPrompt | undefined> {
    const memberId = this.authenticationService.getMemberId();
    return await this.memberPromptService.getPromptById(memberId, promptId);
  }

  @ApiOperation({ summary: 'Get a specific prompt by name' })
  @ApiParam({ name: 'promptName', type: 'string' })
  @ApiResponse({ status: 200, description: 'The prompt details', type: MemberPrompt })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @Get('by-name/:promptName')
  async getPromptByName(@Param('promptName') promptName: string): Promise<MemberPrompt | undefined> {
    const memberId = this.authenticationService.getMemberId();
    return await this.memberPromptService.getPromptByName(memberId, promptName);
  }

  @ApiOperation({ summary: 'Update a prompt' })
  @ApiParam({ name: 'promptId', type: 'string' })
  @ApiBody({ type: UpdateMemberPrompt })
  @ApiResponse({ status: 200, description: 'The prompt has been updated', type: MemberPrompt })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @Put(':promptId')
  async updatePrompt(
    @Param('promptId') promptId: string,
    @Body() updateMemberPrompt: UpdateMemberPrompt
  ): Promise<MemberPrompt | undefined> {
    const memberId = this.authenticationService.getMemberId();
    return await this.memberPromptService.updatePrompt(memberId, promptId, updateMemberPrompt);
  }

  @ApiOperation({ summary: 'Delete a prompt' })
  @ApiParam({ name: 'promptId', type: 'string' })
  @ApiResponse({ status: 200, description: 'The prompt has been deleted' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @Delete(':promptId')
  async deletePrompt(@Param('promptId') promptId: string): Promise<{ success: boolean }> {
    const memberId = this.authenticationService.getMemberId();
    const result = await this.memberPromptService.deletePrompt(memberId, promptId);
    return { success: result };
  }

  @ApiOperation({ summary: 'Delete all prompts for the current member' })
  @ApiResponse({ status: 200, description: 'All prompts have been deleted' })
  @Delete('all')
  async deleteAllPromptsForMember(): Promise<{ success: boolean }> {
    const memberId = this.authenticationService.getMemberId();
    const result = await this.memberPromptService.deleteAllPromptsForMember(memberId);
    return { success: result };
  }
}
