import { ChatCompletionTool } from 'openai/resources/chat/completions';

export class CalculatorTools{
  static getAddMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "add",
        description: "Add two numbers and return the sum.",
        parameters: {
          type: "object",
          properties: {
            a: {
              type: "number",
              description: "The first number.",
            },
            b: {
              type: "number",
              description: "The second number.",
            },
          },
          required: ["a", "b"],
        },
      }
    };
  }

  async add({ a, b }: { a: number; b: number }): Promise<number> {
    return a + b;
  }

  static getSubtractMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "subtract",
        description: "Subtract the second number from the first and return the result.",
        parameters: {
          type: "object",
          properties: {
            a: {
              type: "number",
              description: "The first number.",
            },
            b: {
              type: "number",
              description: "The second number.",
            },
          },
          required: ["a", "b"],
        },
      }
    };
  }

  async subtract({ a, b }: { a: number; b: number }): Promise<number> {
    return a - b;
  }

  static getMultiplyMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "multiply",
        description: "Multiply two numbers and return the product.",
        parameters: {
          type: "object",
          properties: {
            a: {
              type: "number",
              description: "The first number.",
            },
            b: {
              type: "number",
              description: "The second number.",
            },
          },
          required: ["a", "b"],
        },
      }
    };
  }

  async multiply({ a, b }: { a: number; b: number }): Promise<number> {
    return a * b;
  }

  static getDivideMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "divide",
        description: "Divide the first number by the second and return the quotient.",
        parameters: {
          type: "object",
          properties: {
            a: {
              type: "number",
              description: "The numerator.",
            },
            b: {
              type: "number",
              description: "The denominator. Must not be zero.",
            },
          },
          required: ["a", "b"],
        },
      }
    };
  }

  async divide({ a, b }: { a: number; b: number }): Promise<number> {
    if (b === 0) {
      throw new Error("Division by zero is not allowed.");
    }
    return a / b;
  }

}
