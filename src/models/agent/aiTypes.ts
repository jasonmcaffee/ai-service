import InferenceSSESubject from "../InferenceSSESubject";
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { Model } from '../api/conversationApiModels';

//the function context allows us to store values from other tools, so they can be referenced in other tool calls.
//it's passed to the openaiWrapper, who then passes it to every tool call/aiFunction
// export type AiFunctionContext = {
//     inferenceSSESubject?: InferenceSSESubject;
//     aiFunctionExecutor: AiFunctionExecutor<any>;
//     functionResults: object; //where we house "$aiAdd.result", etc.
// };

export type ModelParams = {
    //Controls the randomness of responses. Lower values (e.g., 0.2) produce more deterministic and focused outputs, while higher values (e.g., 0.8) make responses more creative and varied
    temperature: number, //0 - 1. default 1.
    //Nucleus Sampling): Controls diversity by considering only the top P percent of probable words. Lower values make responses more predictable, while higher values allow for more variety
    top_p: number, // 0 - 1.  default 1
    // Reduces repetition by penalizing new tokens based on their frequency in the text so far. Values range from -2.0 to 2.0
    frequency_penalty: number, //-2-2  default 0.
    //Encourages introducing new topics by penalizing tokens that have already appeared in the conversation. Values range from -2.0 to 2.
    presence_penalty: number, //0-1. default 0.

}
//so we can add every message to the db.
export type OnOpenAiMessagesAdded = (p : {openAiMessages: ChatCompletionMessageParam[] }) => Promise<void>;

export type AiFunctionContextV2 = {
    inferenceSSESubject?: InferenceSSESubject;
    aiFunctionExecutor?: AiFunctionExecutor<any>; //optional so we can stream
    functionResultsStorage: object; //where we house "$aiAdd.result", etc.
    memberId: string;
    abortController?: AbortController;
    model?: Model; //needed for agent of agents tool calling.
    modelParams?: ModelParams;
    onOpenAiMessagesAdded?: OnOpenAiMessagesAdded | undefined;
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


