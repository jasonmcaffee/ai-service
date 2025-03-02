import InferenceSSESubject from "../InferenceSSESubject";

//the function context allows us to store values from other tools, so they can be referenced in other tool calls.
//it's passed to the openaiWrapper, who then passes it to every tool call/aiFunction
export type AiFunctionContext = {
    inferenceSSESubject?: InferenceSSESubject;
};

export type AiFunctionResult = { result: any; context: AiFunctionContext };
export type AiFunction = (argumentsFromAi: object, aiFunctionContextMaintainedByUs: AiFunctionContext) => Promise<AiFunctionResult>;

export type AiFunctionExecutor<T> = {
    [K in keyof T as K extends `ai${string}` ? K : never]: AiFunction;
};


