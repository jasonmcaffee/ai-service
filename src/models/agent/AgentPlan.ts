export class AgentPlan{
    functionSteps: FunctionStep[] = [];
}

export class FunctionStep {
    constructor(readonly functionName: string, readonly args: object, ) {
    }

    async do(){

    }
}
