export class LoadModelRequest {
    /**
     * Path to the model file
     * @example "C:\shared-drive\llm_models\Qwen2.5-7B-Instruct.Q6_K.gguf"
     */
    modelPath: string;

    /**
     * Number of GPU layers to use
     * @example 9999
     */
    ngl: number;

    /**
     * Host to bind the server to (optional)
     * @example "0.0.0.0"
     * @default "0.0.0.0"
     */
    host?: string = '0.0.0.0';

    /**
     * Context size
     * @example 60000
     */
    contextSize: number;

    /**
     * Number of tokens to predict
     * @example 10000
     */
    nPredict: number;

    /**
     * Enable Jinja templates for tool calling
     * @example true
     * @default false
     */
    jinja?: boolean = false;
}
