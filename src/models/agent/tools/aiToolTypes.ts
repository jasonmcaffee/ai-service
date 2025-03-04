import { ChatCompletionTool } from 'openai/resources/chat/completions';

const metadataRegistry = new Map<Function, ChatCompletionTool>();

// Create the decorator factory
export function chatCompletionTool(toolDefinition: ChatCompletionTool) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Store the metadata against the method
    metadataRegistry.set(descriptor.value, toolDefinition);
    return descriptor;
  };
}

export function extractChatCompletionToolAnnotationValues(instance: any): ChatCompletionTool[] {
  const result = new Map<string, ChatCompletionTool>();

  // Get all method names from the instance
  const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
    .filter(name => name !== 'constructor' && typeof instance[name] === 'function');

  // Check each method for metadata
  for (const methodName of methodNames) {
    const method = instance[methodName];
    const metadata = metadataRegistry.get(method);

    if (metadata) {
      result.set(methodName, metadata);
    }
  }

  return Array.from(result.values());
}
