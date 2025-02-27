export class ClientAbortedError extends Error{
  constructor(message: string) {
    super(message);
    this.name = "ClientAbortedError";
  }
}
