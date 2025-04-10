import InferenceSSESubject from "../InferenceSSESubject";
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Model } from '../api/conversationApiModels';

//the function context allows us to store values from other tools, so they can be referenced in other tool calls.
//it's passed to the openaiWrapper, who then passes it to every tool call/aiFunction
// export type AiFunctionContext = {
//     inferenceSSESubject?: InferenceSSESubject;
//     aiFunctionExecutor: AiFunctionExecutor<any>;
//     functionResults: object; //where we house "$aiAdd.result", etc.
// };

export type AiFunctionContextV2 = {
    inferenceSSESubject?: InferenceSSESubject;
    aiFunctionExecutor?: AiFunctionExecutor<any>; //optional so we can stream
    functionResultsStorage: object; //where we house "$aiAdd.result", etc.
    memberId: string;
    abortController?: AbortController;
    model?: Model; //needed for agent of agents tool calling.
    // continueToAllowRecursiveCallsToOpenAi: boolean; //after aiCompletePlan executed, we don't want to send the result back to openAi
};

export type AiFunctionResult = { result: any; context: AiFunctionContextV2 };
export type AiFunction = (argumentsFromAi: object, aiFunctionContextMaintainedByUs: AiFunctionContextV2) => Promise<AiFunctionResult>;

interface AiFunctionExecutorMethods {
    getToolsMetadata: () => ChatCompletionTool[]
}

export type AiFunctionExecutor<T> = {
    [K in keyof T as K extends `ai${string}` ? K : never]: AiFunction;
    //a mapped type may not declare properties or methods, so we must put the methods on a different type.
} & AiFunctionExecutorMethods;


