import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import {Image, CreateImage, PagedImages, Message} from '../models/api/conversationApiModels';

@Injectable()
export class ImagesRepository {
    private sql: postgres.Sql;

    constructor() {
        this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
    }

    async getImageByPromptId(promptId: string): Promise<Image>{
        const result = await this.sql<Image[]>`
            select * from image where prompt_id = ${promptId}
        `;
        return result[0];
    }

    async getImageByImageFileName(imageFileName: string): Promise<Image>{
        const result = await this.sql<Image[]>`
            select * from image where image_file_name = ${imageFileName}
        `;
        return result[0];
    }

    /**
     * get all images for the member.
     * @param memberId
     */
    async getImagesForMember(memberId: string): Promise<Image[]> {
        const result = await this.sql<Image[]>`
            select * from image m
            where member_id = ${memberId}
        `;
        return result.length > 0 ? result : [];
    }

    async getPagedImagesForMember(memberId: string, pageNumber: number, numberOfImagesPerPage: number): Promise<PagedImages> {
        // First, get total count of images for pagination calculation
        const totalCountResult = await this.sql<[{count: number}]>`
            SELECT COUNT(*) as count
            FROM image
            WHERE member_id = ${memberId}
        `;
        const totalImages = parseInt(totalCountResult[0].count.toString());

        // Calculate offset
        const offset = (pageNumber - 1) * numberOfImagesPerPage;

        // Get paginated results
        const images = await this.sql<Image[]>`
            SELECT * 
            FROM image 
            WHERE member_id = ${memberId}
            ORDER BY created_date DESC
            LIMIT ${numberOfImagesPerPage}
            OFFSET ${offset}
        `;

        // Calculate remaining pages and images
        const remainingImages = Math.max(0, totalImages - (pageNumber * numberOfImagesPerPage));
        const remainingPages = Math.ceil(remainingImages / numberOfImagesPerPage);

        return {
            pageNumber,
            numberOfImagesPerPage,
            remainingPages,
            remainingImages,
            images
        };
    }

    async createImage(memberId: string, createImage: CreateImage): Promise<Image> {
        try {


            const result = await this.sql<Image[]>`
                insert into image (image_file_name,
                                   prompt_used_to_create_image,
                                   prompt_id,
                                   height,
                                   width,
                                   member_id)
                values (${createImage.imageFileName},
                        ${createImage.promptUsedToCreateImage},
                        ${createImage.promptId},
                        ${createImage.height},
                        ${createImage.width},
                        ${memberId})
                returning *
            `;
            return result[0];
        }catch(e){
            console.error(`error creating image: `, 3);
            throw e;
        }
    }

    async updateImage(promptId: string, updateData: CreateImage): Promise<Image> {
        const result = await this.sql<Image[]>`
            UPDATE image 
            SET 
                prompt_used_to_create_image = COALESCE(${updateData.promptUsedToCreateImage}, prompt_used_to_create_image),
                image_file_name = COALESCE(${updateData.imageFileName}, image_file_name),
                height = COALESCE(${updateData.height}, height),
                width = COALESCE(${updateData.width}, width)
            WHERE prompt_id = ${promptId}
            RETURNING *
        `;

        if (result.length === 0) {
            throw new Error('Image not found');
        }

        return result[0];
    }

    async deleteImage(imageFileName: string){
        await this.sql`delete from image where image_file_name = ${imageFileName}`;
    }

    async deleteImageByPromptId(promptId: string){
        await this.sql`delete from image where prompt_id = ${promptId}`;
    }

    async ensureMemberOwnsImageFileName(memberId: string, imageFileName: string){
        const ownershipCheck = await this.sql`
            select 1 from image i
            where i.member_id = ${memberId}
            and i.image_file_name = ${imageFileName}
        `;

        if (!ownershipCheck.length) {
            throw new Error('Member does not own this image');
        }
    }

    async ensureMemberOwnsImagePromptId(memberId: string, promptId: string){
        const ownershipCheck = await this.sql`
            select 1 from image i
            where i.member_id = ${memberId}
            and i.prompt_id = ${promptId}
        `;

        if (!ownershipCheck.length) {
            throw new Error('Member does not own this image');
        }
    }

}
