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

        console.log(`generate image is now polling for upscale imageFileName result...`);
        this.aiImageService.startPollingForImageCompletionAndReturnImageNameWhenReady(generateImageResponse.promptId).then(async imageFileName => {
            console.log(`generate image completed.  updating the db.`);
            const image = await this.imagesRepository.getImageByPromptId(generateImageResponse.promptId);
            image.imageFileName = imageFileName;
            const updatedImage = await this.imagesRepository.updateImage(generateImageResponse.promptId, image);
        }).catch(e => {
            console.error(`image was not generated, so deleting the entry from the db: ${generateImageResponse.promptId}`);
            //delete from the db.
            this.imagesRepository.deleteImageByPromptId(generateImageResponse.promptId);
        });

        return generateImageResponse; //just return the promptId so they can poll
    }

    async upscaleImageAndStoreInDb(memberId: string, imageFileName: string): Promise<GenerateAiImageResponse>{
        await this.imagesRepository.ensureMemberOwnsImageFileName(memberId, imageFileName);
        const imageToUpscale = await this.imagesRepository.getImageByImageFileName(imageFileName);
        const upscaleImageResponse = await this.aiImageService.upscaleImage(imageFileName);

        //create an entry in the db with an empty file name, which will be updated once polling completes.
        const createImageRequest: CreateImage = {
            width: imageToUpscale.width,
            height: imageToUpscale.height,
            promptUsedToCreateImage: imageToUpscale.promptUsedToCreateImage,
            promptId: upscaleImageResponse.promptId,
            imageFileName: '' //won't have until polling is done.  could be a static gif of loading.
        };
        await this.createImage(memberId, createImageRequest);

        //start polling without waiting, and update the when ready.
        console.log(`upscale image is now polling for upscale imageFileName result...`);
        this.aiImageService.startPollingForImageCompletionAndReturnImageNameWhenReady(upscaleImageResponse.promptId).then(async imageFileName => {
            console.log(`upscale image completed.  updating the db.`)
            const image = await this.imagesRepository.getImageByPromptId(upscaleImageResponse.promptId);
            image.imageFileName = imageFileName;
            const updatedImage = await this.imagesRepository.updateImage(upscaleImageResponse.promptId, image);
        }).catch(e => {
            console.error(`image was not upscaled, so deleting the entry from the db: ${upscaleImageResponse.promptId}`);
            //delete from the db.
            this.imagesRepository.deleteImageByPromptId(upscaleImageResponse.promptId);
        });
        return upscaleImageResponse;
    }

    /**
     * We expect polling to start on the server side when generate or upscale are called.
     * The client will call this function to check the db status.
     * @param memberId
     * @param promptId
     */
    async pollImageStatusByCheckingTheDb(memberId: string, promptId: string): Promise<PollImageStatusResponse>{
        await this.imagesRepository.ensureMemberOwnsImagePromptId(memberId, promptId);
        const image = await this.imagesRepository.getImageByPromptId(promptId);
        if(image.imageFileName == ''){
            throw new Error('Image is still generating.');
        }
        return {imageName: image.imageFileName};
    }

    async createImage(memberId: string, createImage: CreateImage){
        return this.imagesRepository.createImage(memberId, createImage);
    }

    async getPagedImagesForMember(memberId: string, pageNumber:number, numberOfImagesPerPage: number){
        return this.imagesRepository.getPagedImagesForMember(memberId, pageNumber, numberOfImagesPerPage);
    }

    async deleteImage(memberId: string, imageFileName: string){
        await this.imagesRepository.ensureMemberOwnsImageFileName(memberId, imageFileName);
        await this.aiImageService.deleteImageFromDrive(imageFileName);
        return this.imagesRepository.deleteImage(imageFileName);
    }


}
