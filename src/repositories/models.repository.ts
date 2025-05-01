import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import {Model, ModelType, UpdateModel} from '../models/api/conversationApiModels';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class ModelsRepository {
    private sql: postgres.Sql;

    constructor() {
        this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
    }

    async getModelTypes(): Promise<ModelType[]> {
        return this.sql<ModelType[]>`
        SELECT * FROM model_type
      `;
    }

    async getModelById(modelId: string): Promise<Model | undefined> {
        const result = await this.sql<Model[]>`
          SELECT * FROM model WHERE id = ${modelId}
        `;
        return result.length ? result[0] : undefined;
    }

    async getAllModelsForMember(memberId: string): Promise<Model[]> {
        return this.sql<Model[]>`
          SELECT m.* FROM model m
          WHERE m.member_id = ${memberId}
          order by m.id
        `;
    }

    async getDefaultModelForMember(memberId: string): Promise<Model | undefined> {
        const result = await this.sql<Model[]>`
            select * from model where member_id=${memberId} and is_default=true
        `;
        return result.length ? result[0] : undefined;
    }

    async createModel(model: Omit<Model, 'id'>, memberId: string): Promise<Model> {
        return this.sql.begin(async (trx) => {
            if (model.isDefault) {
                await trx`
                UPDATE model SET is_default = false WHERE is_default = true
              `;
            }

            const [createdModel] = await trx<Model[]>`
                INSERT INTO model (id, display_name, url, api_key, model_name, model_type_id, is_default, 
                                   member_id, initial_message, file_path, context_size, additional_llamacpp_server_params, prepend_no_think_tag_to_beginning_of_each_message)
                VALUES (${uuidv4()}, ${model.displayName}, ${model.url}, ${model.apiKey}, ${model.modelName}, ${model.modelTypeId},
                        ${model.isDefault}, ${memberId}, ${model.initialMessage || null}, ${model.filePath || null},
                       ${model.contextSize || null}, ${model.additionalLlamacppServerParams || null}, ${model.prependNoThinkTagToBeginningOfEachMessage || null} )
                RETURNING *
            `;

            //insert into the member table so we can associate messages with correct model that sent it.
            await trx`
                insert into member (member_id, member_name) values (${createdModel.id}, ${createdModel.displayName})
            `
            return createdModel;
        });
    }

    async updateModel(modelId: string, model: UpdateModel){
        return this.sql.begin(async (trx) => {
            if (model.isDefault) {
                await trx`UPDATE model SET is_default = false WHERE is_default = true`;
            }

            const [updatedModel] = await trx<Model[]>`
              UPDATE model
              SET display_name = ${model.displayName    },
                  url = ${model.url                  },
                  api_key = ${model.apiKey         },
                  model_name = ${model.modelName       },
                  model_type_id = ${model.modelTypeId  },
                  is_default = ${model.isDefault },
                  initial_message = ${model.initialMessage  ?? null},
                  file_path = ${model.filePath ?? null},
                  context_size = ${model.contextSize ?? null},
                  additional_llamacpp_server_params = ${model.additionalLlamacppServerParams ?? null},
                  prepend_no_think_tag_to_beginning_of_each_message = ${model.prependNoThinkTagToBeginningOfEachMessage ?? null}
              WHERE id = ${modelId}
              RETURNING *
            `;

            // const [updatedModel] = await trx<Model[]>`
            //     UPDATE model
            //         SET display_name = ${model.displayName},
            //         url = ${model.url},
            //         api_key = ${model.apiKey},
            //         model_name = ${model.modelName},
            //         model_type_id = ${model.modelTypeId},
            //         is_default = ${model.isDefault},
            //         initial_message = ${model.initialMessage},
            //         file_path = ${model.filePath},
            //         context_size = ${model.contextSize},
            //         additional_llamacpp_server_params = ${model.additionalLlamacppServerParams},
            //         prepend_no_think_tag_to_beginning_of_each_message = ${model.prependNoThinkTagToBeginningOfEachMessage}
            //     WHERE id = ${modelId}
            //     RETURNING *
            //     `;
            return updatedModel;
        });
    }

    async deleteModel(modelId: string, memberId: string): Promise<void> {
        await this.sql.begin(async (trx) => {
            await trx`
                DELETE FROM model WHERE id = ${modelId}
            `;
        });
    }

    async ensureMemberOwnsModel(memberId: string, modelId: string): Promise<void> {
        const result = await this.sql<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM model WHERE member_id = ${memberId} AND id = ${modelId}
          ) AS exists
        `;
        if (!result[0]?.exists) {
            throw new Error(`Member ${memberId} does not own model ${modelId}`);
        }
    }
}
