import InferenceSSESubject from "../InferenceSSESubject";

export type AiFunctionContext = {
    inferenceSSESubject?: InferenceSSESubject;
};

export type AiFunctionResult = { result: object; context: AiFunctionContext };
export type AiFunction = (argumentsFromAi: object, aiFunctionContextMaintainedByUs: AiFunctionContext) => Promise<AiFunctionResult>;

export type AiFunctionExecutor<T> = {
    [K in keyof T as K extends `ai${string}` ? K : never]: AiFunction;
};


