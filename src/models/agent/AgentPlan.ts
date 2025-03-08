export class AgentPlan{
    functionSteps: AiFunctionStep[] = [];
    constructor(private readonly id: string, public doFunctionsExistToFulfillTheUserRequest: boolean = false) {}
}

export class AiFunctionStep {
    //this is set by PlanExecutor after the function is executed.
    public result: any;

    //what the PlanExecutor actually passed when calling the function.
    //Can be different than functionArgumentsPassedByLLM due to variable swapping. e.g. $aiAdd.result
    public functionArgumentsUsedDuringExecution: any;

    constructor(
      readonly id: string,
      readonly functionName: string,
      readonly functionArgumentsPassedByLLM: object,
      readonly reasonToAddStep: string, ) {
    }
}
