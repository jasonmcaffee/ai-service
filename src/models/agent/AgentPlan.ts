export class AgentPlan{
    functionSteps: AiFunctionStep[] = [];
    constructor(private readonly id: string) {}
}

export class AiFunctionStep {
    constructor(readonly id: string, readonly functionName: string, readonly args: object, readonly reasonToAddStep: string, readonly toolIsExplicitlyDefinedInTheToolsXmlTag: boolean) {
    }
}
