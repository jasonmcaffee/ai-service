import InferenceSSESubject from "../InferenceSSESubject";
import { ChatCompletionTool } from 'openai/resources/chat/completions';

//the function context allows us to store values from other tools, so they can be referenced in other tool calls.
//it's passed to the openaiWrapper, who then passes it to every tool call/aiFunction
export type AiFunctionContext = {
    inferenceSSESubject?: InferenceSSESubject;
    aiFunctionExecutor: AiFunctionExecutor<any>;
    functionResults: object; //where we house "$aiAdd.result", etc.
};

export type AiFunctionContextV2 = {
    inferenceSSESubject?: InferenceSSESubject;
    aiFunctionExecutor: AiFunctionExecutor<any>;
    functionResults: object; //where we house "$aiAdd.result", etc.
    memberId: string;
    abortController?: AbortController;
};

export type AiFunctionResult = { result: any; context: AiFunctionContext };
export type AiFunction = (argumentsFromAi: object, aiFunctionContextMaintainedByUs: AiFunctionContext) => Promise<AiFunctionResult>;

interface AiFunctionExecutorMethods {
    getToolsMetadata: () => ChatCompletionTool[]
}

export type AiFunctionExecutor<T> = {
    [K in keyof T as K extends `ai${string}` ? K : never]: AiFunction;
    //a mapped type may not declare properties or methods, so we must put the methods on a different type.
} & AiFunctionExecutorMethods;


