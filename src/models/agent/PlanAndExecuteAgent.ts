import PlannerAgent from './PlannerAgent';
import { Model } from '../api/conversationApiModels';
import { OpenaiWrapperService } from '../../services/openaiWrapper.service';
import { PlanExecutor } from './PlanExecutor';
import { AiFunctionContext, AiFunctionExecutor } from './aiTypes';

export class PlanAndExecuteAgent<TAiFunctionExecutor>{
  constructor(private readonly model: Model, private readonly openAiWrapperService: OpenaiWrapperService, private readonly memberId: string, private readonly aiFunctionExecutor: AiFunctionExecutor<TAiFunctionExecutor>) {
  }

  async createAndExecutePlanUsingTools<TAiFunctionExecutor>(prompt: string){
    try{
      const plannerAgent = new PlannerAgent(this.model, this.openAiWrapperService, this.memberId, this.aiFunctionExecutor);
      const { openAiMessages, completeText, totalOpenAiCallsMade, agentPlan } = await plannerAgent.createPlan(prompt);
      const aiFunctionContext: AiFunctionContext = {functionResults: {}, aiFunctionExecutor: this.aiFunctionExecutor};
      const planExecutor = new PlanExecutor(agentPlan, aiFunctionContext);
      if(!plannerAgent.agentPlan){
        console.error(`agentPlan is missing!`, plannerAgent);
        throw new Error('agentPlan is missing'); //todo: sometimes the closing tag isn't supplied.  We should add retry plan N times.
      }
      await planExecutor.executePlan();
      const planFinalResult = await planExecutor.getFinalResultFromPlan();
      return planFinalResult;
    }catch(e){
      console.error(`PlanAndExecuteAgent error: `, e);
      throw e;
    }

  }



}
