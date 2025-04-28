import { Injectable } from '@nestjs/common';
import { MemberPrompt, CreateMemberPrompt, UpdateMemberPrompt } from '../models/api/conversationApiModels';
import { MemberPromptRepository } from '../repositories/memberPrompt.repository';

@Injectable()
export class MemberPromptService {
  constructor(
    private readonly memberPromptRepository: MemberPromptRepository,
  ) {}

  /**
   * Creates a new prompt for a member.
   * @param memberId - The ID of the member.
   * @param createMemberPrompt - DTO containing prompt details.
   */
  async createPrompt(memberId: string, createMemberPrompt: CreateMemberPrompt): Promise<MemberPrompt> {
    const { promptName, promptText } = createMemberPrompt;
    return this.memberPromptRepository.createPrompt(memberId, promptName, promptText);
  }

  /**
   * Retrieves all prompts for a specific member.
   * @param memberId - The ID of the member.
   */
  async getPromptsForMemberId(memberId: string): Promise<MemberPrompt[]> {
    return this.memberPromptRepository.getPromptsForMemberId(memberId);
  }

  /**
   * Retrieves a specific prompt by ID.
   * @param memberId - The ID of the member (for ownership verification).
   * @param promptId - The ID of the prompt.
   */
  async getPromptById(memberId: string, promptId: string): Promise<MemberPrompt | undefined> {
    await this.memberPromptRepository.ensureMemberOwnsPrompt(memberId, promptId);
    return this.memberPromptRepository.getPromptById(promptId);
  }

  async getPromptByIds(memberId: string, promptIds: string[]): Promise<MemberPrompt[] | undefined> {
    await this.memberPromptRepository.ensureMemberOwnsPrompts(memberId, promptIds);
    return this.memberPromptRepository.getPromptByIds(promptIds);
  }

  /**
   * Retrieves a specific prompt by name for a member.
   * @param memberId - The ID of the member.
   * @param promptName - The name of the prompt.
   */
  async getPromptByName(memberId: string, promptName: string): Promise<MemberPrompt | undefined> {
    return this.memberPromptRepository.getPromptByName(memberId, promptName);
  }

  /**
   * Updates an existing prompt.
   * @param memberId - The ID of the member (for ownership verification).
   * @param promptId - The ID of the prompt.
   * @param updateMemberPrompt - DTO containing updated prompt details.
   */
  async updatePrompt(memberId: string, promptId: string, updateMemberPrompt: UpdateMemberPrompt): Promise<MemberPrompt | undefined> {
    await this.memberPromptRepository.ensureMemberOwnsPrompt(memberId, promptId);
    return this.memberPromptRepository.updatePrompt(promptId, updateMemberPrompt);
  }

  /**
   * Deletes a prompt by ID.
   * @param memberId - The ID of the member (for ownership verification).
   * @param promptId - The ID of the prompt to delete.
   */
  async deletePrompt(memberId: string, promptId: string): Promise<boolean> {
    await this.memberPromptRepository.ensureMemberOwnsPrompt(memberId, promptId);
    return this.memberPromptRepository.deletePrompt(promptId);
  }

  /**
   * Deletes all prompts for a member.
   * @param memberId - The ID of the member.
   */
  async deleteAllPromptsForMember(memberId: string): Promise<boolean> {
    return this.memberPromptRepository.deleteAllPromptsForMember(memberId);
  }
}
