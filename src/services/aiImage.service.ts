import fs from 'fs/promises';
import config from '../config/config';
import {Injectable} from "@nestjs/common";
import {GenerateAiImageResponse, PollImageStatusResponse} from "../models/api/conversationApiModels";
const WORKFLOW_DIR = `${config.getSharedDriveBasePath()}/llm_models/ComfyUI_windows_portable/comfyui_workflows`;
// const workflowPath = `${WORKFLOW_DIR}/api version flux realism lora and upscaler - jason - v6.json`;
const workflowPath = `${WORKFLOW_DIR}/api flux v1 dev hand-lora realism-lora no-upscale - jason v1.json`;

let workflow: any;
const baseUrl = 'http://192.168.0.209:8082';
const generateImageUrl = `${baseUrl}/prompt`;
const getImageStatusUrl = `${baseUrl}/history`;
const clientId = "123456";

@Injectable()
export class AIImageService {

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
            if(!workflow){
                workflow = await fs.readFile(workflowPath, 'utf-8');
                // console.log(`workflow is:`, workflow);
                console.log(`workflow loaded`);
            }

            const workflowJson = JSON.parse(workflow);
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
            console.error('Error serving image:', error);
            throw new Error(`Error serving image: ${error}`);
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
