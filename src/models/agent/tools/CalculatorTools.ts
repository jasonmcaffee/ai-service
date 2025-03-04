import { ChatCompletionTool } from 'openai/resources/chat/completions';
import {AiFunctionContext, AiFunctionExecutor, AiFunctionResult} from "../aiTypes";
import { AIFunctionsWithMetadata, chatCompletionTool, extractChatCompletionToolAnnotationValues } from './aiToolTypes';

export class CalculatorTools implements AiFunctionExecutor<CalculatorTools>, AIFunctionsWithMetadata{

  // Exponentiation Function
  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiExponentiation",
      description: "Raise a base number to the power of an exponent. For example, 'two raised to the power of three' would translate to aiExponentiation(2, 3); 'compute five to the power of four' becomes aiExponentiation(5, 4); and 'what is nine raised to 2' would be aiExponentiation(9, 2). This function is designed to handle typical exponentiation requests as described in natural language.",
      parameters: {
        type: "object",
        properties: {
          base: {
            type: "number",
            description: "The base number that is to be raised to a power.",
          },
          exponent: {
            type: "number",
            description: "The exponent that the base number is raised to.",
          },
        },
        required: ["base", "exponent"],
      },
    }
  })
  async aiExponentiation({ base, exponent }: { base: number; exponent: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return { result: Math.pow(base, exponent), context };
  }

  // Modulo Function
  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiModulo",
      description: "Compute the remainder of dividing one number by another. For instance, 'the remainder when 10 is divided by 3' would be aiModulo(10, 3); 'find modulo of 17 by 4' translates to aiModulo(17, 4); and 'what is 23 mod 5' becomes aiModulo(23, 5). This function helps parse natural language requests for modulo operations.",
      parameters: {
        type: "object",
        properties: {
          dividend: {
            type: "number",
            description: "The number to be divided (the dividend).",
          },
          divisor: {
            type: "number",
            description: "The number by which the dividend is divided (the divisor).",
          },
        },
        required: ["dividend", "divisor"],
      },
    }
  })
  async aiModulo({ dividend, divisor }: { dividend: number; divisor: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return { result: dividend % divisor, context };
  }

  // Square Root Function
  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiSquareRoot",
      description: "Calculate the square root of a given number. For example, 'what is the square root of 16' would be aiSquareRoot(16); 'find the square root of 81' translates to aiSquareRoot(81); and 'compute the square root for 25' becomes aiSquareRoot(25). This function converts natural language square root queries into a formal function call.",
      parameters: {
        type: "object",
        properties: {
          value: {
            type: "number",
            description: "The number for which to compute the square root.",
          },
        },
        required: ["value"],
      },
    }
  })
  async aiSquareRoot({ value }: { value: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return { result: Math.sqrt(value), context };
  }

// Factorial Function
  @chatCompletionTool({
    type: "function",
    function: {
      name: "aiFactorial",
      description: "Calculate the factorial of a non-negative integer, which is the product of all positive integers up to that number. For instance, 'what is 5 factorial' would translate to aiFactorial(5); 'compute the factorial of 4' becomes aiFactorial(4); and 'find 7!' would be interpreted as aiFactorial(7). This function is ideal for converting natural language requests into factorial computations.",
      parameters: {
        type: "object",
        properties: {
          n: {
            type: "number",
            description: "A non-negative integer for which to compute the factorial.",
          },
        },
        required: ["n"],
      },
    }
  })
  async aiFactorial({ n }: { n: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return { result, context };
  }


  @chatCompletionTool({
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
  })
  async aiAdd({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return {result: a + b, context};
  }

  @chatCompletionTool({
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
  })
  async aiSubtract({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return {result: a - b, context};
  }

  @chatCompletionTool({
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
  })
  async aiMultiply({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    return {result: a * b, context};
  }

  @chatCompletionTool({
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
  })
  async aiDivide({ a, b }: { a: number; b: number }, context: AiFunctionContext): Promise<AiFunctionResult> {
    if (b === 0) {
      throw new Error("Division by zero is not allowed.");
    }
    return {result: a / b, context};
  }

  getToolsMetadata(): ChatCompletionTool[] {
    return extractChatCompletionToolAnnotationValues(this);
  }

}
