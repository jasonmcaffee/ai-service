export class ClientAbortedError extends Error{
  constructor(message: string) {
    super(message);
    this.name = "ClientAbortedError";
  }
}

export class InvalidToolCallJsonFromLLM extends Error{
  constructor(message: string) {
    super(message);
    this.name = "InvalidToolCallJsonFromLLM";
  }
}
