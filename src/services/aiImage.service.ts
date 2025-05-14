import * as fs from 'fs/promises';
import config from '../config/config';
import {Injectable} from "@nestjs/common";
import {
    GenerateAiImageResponse,
    GenerateAndReturnAiImageResponse,
    PollImageStatusResponse
} from "../models/api/conversationApiModels";

import * as path from 'path';
const WORKFLOW_DIR = `${config.getSharedDriveBasePath()}/llm_models/ComfyUI_windows_portable/comfyui_workflows`;
// const workflowPath = `${WORKFLOW_DIR}/api version flux realism lora and upscaler - jason - v6.json`;
const generateImageWorkflowPath = `${WORKFLOW_DIR}/api flux v1 dev hand-lora realism-lora no-upscale - jason v1.json`;
const upscaleImageWorkflowPath = `${WORKFLOW_DIR}/api upscale image flux - jason v1.json`;

const imagesPath = `${config.getSharedDriveBasePath()}/llm_models/ComfyUI_windows_portable/ComfyUI/output`;

let generateImageWorkflow: any;
let upscaleWorkflow: any;
const baseUrl = 'http://192.168.0.157:8082';
const generateImageUrl = `${baseUrl}/prompt`;
const getImageStatusUrl = `${baseUrl}/history`;
const uploadImageUrl = `${baseUrl}/upload/image`;

@Injectable()
export class AIImageService {

    async deleteImageFromDrive(imageName: string){
        const filePath = path.join(`${imagesPath}`, imageName);
        console.log(`deleting image from drive: ${filePath}`);
        await fs.rm(filePath);
    }

    async startPollingForImageCompletionAndReturnImageNameWhenReady(promptId: string): Promise<string>{
        const waitTimeBetweenPollsMs = 1000;
        const maxMinutesMs = 5 * 60 * 1000;
        const maxPollTries = Math.ceil(maxMinutesMs / waitTimeBetweenPollsMs);
        return new Promise<string>(async (resolve, reject) => {
            let count = 0;
            while(count < maxPollTries) {
                try {
                    const result = await this.pollImageStatus(promptId);
                    if (result.imageName) {
                        resolve(result.imageName);
                        return;
                    }
                } catch(e) {
                    // console.error('startPollingForImageCompletionThenUpdateDb Error polling image status:', e);
                }

                count += 1;
                await new Promise(resolve => setTimeout(resolve, waitTimeBetweenPollsMs));
            }

            reject(new Error('startPollingForImageCompletionThenUpdateDb Timeout waiting for image generation'));
        });
    }

    async generateAndReturnImage(width: number, height: number, prompt: string, prefix: string): Promise<GenerateAndReturnAiImageResponse> {
        const {promptId} = await this.generateImage(width, height, prompt, prefix);

        return new Promise(async (resolve, reject) => {
            let count = 0;
            const maxPollTries = 5 * 60;
            while(count < maxPollTries) {
                try {
                    const result = await this.pollImageStatus(promptId);
                    if (result.imageName) {
                        console.log(`got back imageName: ${result.imageName}`);
                        const imagePath = path.join(imagesPath, decodeURIComponent(result.imageName));

                        // Read the file and convert to base64
                        const imageBuffer = await fs.readFile(imagePath);
                        const base64Image = imageBuffer.toString('base64');

                        // Determine MIME type based on file extension
                        const mimeType = result.imageName.toLowerCase().endsWith('.png')
                          ? 'image/png'
                          : 'image/jpeg';

                        resolve({
                            data: `data:${mimeType};base64,${base64Image}`,
                            mimeType,
                            promptId,
                            prompt,
                        });
                        return;
                    }
                } catch(e) {
                    console.error('Error polling image status:', e);
                }

                count += 1;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            reject(new Error('Timeout waiting for image generation'));
        });
    }

    async pollImageStatus(promptId: string): Promise<PollImageStatusResponse>{
        const pollUrl = `${getImageStatusUrl}/${promptId}`;
        const response = await fetch(pollUrl);
        const data = await response.json();

        console.log(`poll for completion data: `, JSON.stringify(data));
        //@ts-ignore
        if(!data || !data[promptId]?.status){
            throw new Error(`No prompt id status found for ${promptId}`);
        }
        //@ts-ignore
        const promptData = data[promptId];
        if (promptData.status?.completed === true) {
            console.log(`Image generated: ${promptId}`);
            const [firstKey] = Object.keys(promptData.outputs);
            console.log(`first key is: ${firstKey}`);
            const images = promptData.outputs[firstKey].images;
            console.log('images', images);
            const image = images[0];
            const imageName = image.filename;
            // const imageUrl = `/api/image/${imageName}`;
            return {imageName};
        }
        throw new Error('Not found');
    }

    async generateImage(width: number, height: number, prompt: string, prefix: string): Promise<GenerateAiImageResponse>{
        try {
            const batchSize = 1; //only allow 1 to make polling simpler.

            console.log(`generate image called: `);
            if(!generateImageWorkflow){
                console.log(`reading workflow file path: ${generateImageWorkflowPath}`, fs);
                generateImageWorkflow = await fs.readFile(generateImageWorkflowPath, 'utf-8');
                // console.log(`workflow is:`, workflow);
                console.log(`workflow loaded`);
            }

            const workflowJson = JSON.parse(generateImageWorkflow);
            // console.log(`workflowJson: `, workflowJson);
            //
            console.log(`setting node values...`);
            // const promptNode = workflowJson["83"];
            const promptNode = findObjectsByClassType(workflowJson,"CLIPTextEncode")?.[0]!;
            promptNode.inputs.text = prompt;

            //you must do random noise or you will get an issue where the prompt is finished in 0 seconds and there is no output, regardless if you change the prompt.
            // const randomNoise = workflowJson["25"];
            const randomNoise = findObjectsByClassType(workflowJson,"RandomNoise")?.[0]!;
            randomNoise.inputs.noise_seed = Math.floor(Math.random() * 9e14) + 1e14;  //15 digit long random number

            // const seedNode = workflowJson["52"];
            // seedNode.inputs.seed = Math.floor(Math.random() * 9e14) + 1e14;  //15 digit long random number

            // const sizeNode = workflowJson["5"];
            const sizeNode = findObjectsByClassType(workflowJson,"EmptyLatentImage")?.[0]!;
            sizeNode.inputs.width = width;
            sizeNode.inputs.height = height;
            sizeNode.inputs.batch_size = batchSize;

            // const prefixNode = workflowJson["84"];
            const prefixNode = findObjectsByClassType(workflowJson,"SaveImage")?.[0]!;
            prefixNode.inputs.filename_prefix = prefix;

            // console.log(`making request...`, JSON.stringify(workflowJson));
            const request = {prompt: workflowJson} ; //use the same client id so to avoid reloading the model between each request
            const requestString = JSON.stringify(request);

            // console.log(`request string`, requestString);
            const response = await fetch(generateImageUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: requestString,
            });

            if (!response.ok) {
                throw new Error('response from comfy is no good.');
            }
            // console.log(`got response: `, response);

            const data = await response.json();
            console.log('Image generation started:', data);
            // const promptId = data.prompt_id;
            // const imageName = await pollForCompletion(promptId);
            // data.imageName = imageName;
            // res.status(200).json(data);
            const promptId = data.prompt_id;
            return {promptId};

        } catch (error) {
            console.error('Error generating image:', error);
            throw new Error(`Error generating image: ${error}`);
        }
    }

    /**
     * Upscales image by 1.1 (upscale_by param of Ultimate SD Upscale)
     * Finds the imageName in the images dir.
     * Uploads the image to comfyUI.
     * Sends the request to upscale the image.
     * Returns a promptId that can be used for polling the prompt status.
     * @param imageName
     */
    async upscaleImage(imageName: string): Promise<GenerateAiImageResponse>{
        try {
            const prefix = `upscaled_${imageName.replace(/\.[^/.]+$/, "")}`;

            console.log(`generate image called: `, imageName);
            if(!upscaleWorkflow){
                upscaleWorkflow = await fs.readFile(upscaleImageWorkflowPath, 'utf-8');
            }

            const imagePath = `${imagesPath}/${imageName}`;
            const uploadedImageName = await this.uploadImageToComfyUI(imagePath);
            console.log(`upscaleImaged uploaded image name: ${uploadedImageName}`);

            const workflowJson = JSON.parse(upscaleWorkflow);
            console.log(`setting node values...`);
            // const promptNode = workflowJson["83"];
            const promptNode = findObjectsByClassType(workflowJson,"LoadImage")?.[0]!;
            promptNode.inputs.image = uploadedImageName;

            const prefixNode = findObjectsByClassType(workflowJson,"SaveImage")?.[0]!;
            prefixNode.inputs.filename_prefix = prefix;

            // console.log(`making request...`, JSON.stringify(workflowJson));
            const request = {prompt: workflowJson} ; //use the same client id so to avoid reloading the model between each request
            const requestString = JSON.stringify(request);

            const response = await fetch(generateImageUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: requestString,
            });

            if (!response.ok) {
                throw new Error(`error telling comfyui to upscale image: ${response}`)
            }

            const data = await response.json();
            console.log('Upscale image generation started:', data);
            const promptId = data.prompt_id;
            return {promptId};
        } catch (error) {
            console.error('Error upscaling image:', error);
            throw new Error(`error upscaling image: ${error}`);
        }
    }

    /**
     * Uploads an image to comfyui and returns the image name.
     * Used during the upscaling process.
     * @param imagePath
     */
    async uploadImageToComfyUI(imagePath: string): Promise<string> {
        try {
            // Read the image file
            const imageBuffer = await fs.readFile(imagePath);

            // Create a FormData-like object
            const formData = new FormData();
            formData.append('image', new Blob([imageBuffer]), path.basename(imagePath));

            // Make the POST request to ComfyUI's upload endpoint

            const response = await fetch(uploadImageUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.name;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }
}

interface DataObject {
    inputs: any;
    class_type: string;
    _meta: object;
}

function findObjectsByClassType(data: { [key: string]: DataObject }, classType: string): DataObject[] {
    const results: DataObject[] = [];

    for (const key in data) {
        if (data.hasOwnProperty(key) && data[key].class_type === classType) {
            results.push(data[key]);
        }
    }

    return results;
}
