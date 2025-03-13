import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { MemberPrompt, CreateMemberPrompt, UpdateMemberPrompt } from '../models/api/conversationApiModels';
import { uuid } from '../utils/utils';

@Injectable()
export class MemberPromptRepository {
  private sql: postgres.Sql;

  constructor() {
    this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
  }

  /**
   * Creates a new prompt for a member.
   * @param memberId - The ID of the member.
   * @param promptName - The name of the prompt.
   * @param promptText - The text content of the prompt.
   */
  async createPrompt(memberId: string, promptName: string, promptText: string): Promise<MemberPrompt> {
    const [result] = await this.sql<MemberPrompt[]>`
      INSERT INTO member_prompt (id, member_id, prompt_name, prompt_text)
      VALUES (${uuid()}, ${memberId}, ${promptName}, ${promptText})
      RETURNING id, member_id as "memberId", prompt_name as "promptName", prompt_text as "promptText";
    `;

    return result;
  }

  /**
   * Retrieves all prompts for a specific member.
   * @param memberId - The ID of the member.
   */
  async getPromptsForMemberId(memberId: string): Promise<MemberPrompt[]> {
    const result = await this.sql<MemberPrompt[]>`
      SELECT id, member_id as "memberId", prompt_name as "promptName", prompt_text as "promptText"
      FROM member_prompt
      WHERE member_id = ${memberId};
    `;
    return result;
  }

  /**
   * Retrieves a specific prompt by ID.
   * @param promptId - The ID of the prompt.
   */
  async getPromptById(promptId: string): Promise<MemberPrompt | undefined> {
    const result = await this.sql<MemberPrompt[]>`
      SELECT id, member_id as "memberId", prompt_name as "promptName", prompt_text as "promptText"
      FROM member_prompt
      WHERE id = ${promptId};
    `;
    return result.length ? result[0] : undefined;
  }

  /**
   * Retrieves a specific prompt by name for a member.
   * @param memberId - The ID of the member.
   * @param promptName - The name of the prompt.
   */
  async getPromptByName(memberId: string, promptName: string): Promise<MemberPrompt | undefined> {
    const result = await this.sql<MemberPrompt[]>`
      SELECT id, member_id as "memberId", prompt_name as "promptName", prompt_text as "promptText"
      FROM member_prompt
      WHERE member_id = ${memberId} AND prompt_name = ${promptName};
    `;
    return result.length ? result[0] : undefined;
  }

  /**
   * Updates an existing prompt.
   * @param promptId - The ID of the prompt.
   * @param updates - Object containing fields to update.
   */
  async updatePrompt(promptId: string, updates: { promptName: string; promptText: string }): Promise<MemberPrompt | undefined> {
    const [updatedMemberPrompt] = await this.sql<MemberPrompt[]>`
        UPDATE member_prompt
              SET prompt_name = COALESCE(${updates.promptName}, prompt_name),
                  prompt_text = COALESCE(${updates.promptText}, prompt_text)
              WHERE id = ${promptId}
              RETURNING *
    `;

    return updatedMemberPrompt;
  }

  /**
   * Checks if a prompt belongs to a member.
   * @param memberId - The ID of the member.
   * @param promptId - The ID of the prompt.
   */
  async ensureMemberOwnsPrompt(memberId: string, promptId: string): Promise<boolean> {
    const result = await this.sql`
      SELECT 1 FROM member_prompt
      WHERE id = ${promptId} AND member_id = ${memberId}
    `;

    if (!result.length) {
      throw new Error('Not found');
    }

    return true;
  }

  /**
   * Deletes a prompt by ID.
   * @param promptId - The ID of the prompt to delete.
   */
  async deletePrompt(promptId: string): Promise<boolean> {
    const result = await this.sql`
      DELETE FROM member_prompt
      WHERE id = ${promptId};
    `;
    return result.count > 0;
  }

  /**
   * Deletes all prompts for a member.
   * @param memberId - The ID of the member.
   */
  async deleteAllPromptsForMember(memberId: string): Promise<boolean> {
    const result = await this.sql`
        DELETE FROM member_prompt
        WHERE member_id = ${memberId};
    `;
    return result.count > 0;
  }
}
