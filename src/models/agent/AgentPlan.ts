export class AgentPlan{
    functionSteps: AiFunctionStep[] = [];
    constructor(private readonly id: string, public doFunctionsExistToFulfillTheUserRequest: boolean = false) {}
}

export class AiFunctionStep {
    public result: any;//this is set after the function is executed.
    constructor(
      readonly id: string,
      readonly functionName: string,
      readonly args: object,
      readonly reasonToAddStep: string, ) {
    }
}
