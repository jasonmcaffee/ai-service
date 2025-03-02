import { ChatCompletionTool } from 'openai/resources/chat/completions';
import {AiFunctionContext, AiFunctionExecutor, AiFunctionResult} from "./AiFunctionExecutor";

export class CalculatorTools implements AiFunctionExecutor<CalculatorTools>{
  static getAiAddMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiAdd",
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
  async aiAdd({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return {result: a + b, context};
  }

  static getAiSubtractMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiSubtract",
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
  async aiSubtract({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return {result: a - b, context};
  }

  static getAiMultiplyMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiMultiply",
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
  async aiMultiply({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return {result: a * b, context};
  }

  static getAiDivideMetadata(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "aiDivide",
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
  async aiDivide({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    if (b === 0) {
      throw new Error("Division by zero is not allowed.");
    }
    return {result: a / b, context};
  }

}
