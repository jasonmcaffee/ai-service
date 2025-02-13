import { Injectable } from '@nestjs/common';
import {CreateImage, GenerateAiImageResponse, PollImageStatusResponse} from '../models/api/conversationApiModels';
import {ImagesRepository} from "../repositories/images.repository";
import {AIImageService} from "./aiImage.service";
import {c} from "openapi-typescript";

@Injectable()
export class ImagesService {
    constructor(
        private readonly imagesRepository: ImagesRepository,
        private readonly aiImageService: AIImageService,
    ) {}


    async generateImageAndStoreInDb(memberId: string, width: number, height: number, prompt: string, prefix: string): Promise<GenerateAiImageResponse>{
        const generateImageResponse = await this.aiImageService.generateImage(width, height, prompt, prefix);

        //create an entry in the db with an empty file name, which will be updated once polling completes.
        const createImageRequest: CreateImage = {
            width,
            height,
            promptUsedToCreateImage: prompt,
            promptId: generateImageResponse.promptId,
            imageFileName: '' //won't have until polling is done.  could be a static gif of loading.
        };
        await this.createImage(memberId, createImageRequest);

        return generateImageResponse; //just return the promptId so they can poll
    }

    async pollImageStatusAndUpdateEntryInDb(memberId: string, promptId: string): Promise<PollImageStatusResponse>{
        await this.imagesRepository.ensureMemberOwnsImagePromptId(memberId, promptId);
        //this will throw Not Found error if it's not ready yet. imageName is returned if it is ready.
        const pollImageResponse = await this.aiImageService.pollImageStatus(promptId);

        const image = await this.imagesRepository.getImageByPromptId(promptId);
        image.imageFileName = pollImageResponse.imageName;

        const updatedImage = await this.imagesRepository.updateImage(image.imageFileName, image);

        return pollImageResponse;
    }

    async createImage(memberId: string, createImage: CreateImage){
        return this.imagesRepository.createImage(memberId, createImage);
    }

    async getPagedImagesForMember(memberId: string, pageNumber:number, numberOfImagesPerPage: number){
        return this.imagesRepository.getPagedImagesForMember(memberId, pageNumber, numberOfImagesPerPage);
    }

    async deleteImage(memberId: string, imageFileName: string){
        await this.imagesRepository.ensureMemberOwnsImageFileName(memberId, imageFileName);
        return this.imagesRepository.deleteImage(imageFileName);
    }
}
