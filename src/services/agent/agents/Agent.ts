import { AiFunctionContextV2, AiFunctionExecutor } from '../../../models/agent/aiTypes';

export type Agent<T> = AiFunctionExecutor<T> & {
    //an agent is meant to have a single nli interface.
    //separating it out makes it easier to directly interact with the agent.
    handlePrompt: (prompt: string, originalAiFunctionContext: AiFunctionContextV2) => Promise<string>;
}
