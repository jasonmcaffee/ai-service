export class AgentPlan{
    functionSteps: FunctionStep[] = [];
    constructor(private readonly id: string) {}
}

export class FunctionStep {
    constructor(readonly id: string, readonly functionName: string, readonly args: object, readonly reasonToAddStep: string) {
    }
}
