export class AgentPlan{
    functionSteps: FunctionStep[] = [];
    constructor() {}

}

export class FunctionStep {
    constructor(readonly id: string, readonly functionName: string, readonly args: object, readonly reasonToAddStep: string) {
    }

    async do(){

    }
}
