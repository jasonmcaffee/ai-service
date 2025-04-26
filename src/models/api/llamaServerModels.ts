import {ApiProperty} from "@nestjs/swagger";

export class LoadModelRequest {

    /**
     * Path to the model file
     * @example "C:\shared-drive\llm_models\Qwen2.5-7B-Instruct.Q6_K.gguf"
     */
    @ApiProperty()
    modelPath?: string = "C:\\shared-drive\\llm_models\\Qwen2.5-7B-Instruct.Q6_K.gguf";

    /**
     * Number of GPU layers to use
     * @example 9999
     */
    @ApiProperty({nullable: true})
    ngl?: number = 9999;

    /**
     * Host to bind the server to (optional)
     * @example "0.0.0.0"
     * @default "0.0.0.0"
     */
    @ApiProperty({nullable: true})
    host?: string = '0.0.0.0';

    /**
     * Context size
     * @example 60000
     */
    @ApiProperty({nullable: true})
    contextSize?: number = 60000;

    // /**
    //  * Number of tokens to predict
    //  * @example 10000
    //  */
    // @ApiProperty({nullable: true})
    // nPredict?: number = 10000;

    /**
     * Enable Jinja templates for tool calling
     * @example true
     * @default false
     */
    @ApiProperty({nullable: true})
    jinja?: boolean = true;

    @ApiProperty({nullable: true})
    additionalLlamacppServerParams?: string;
}
