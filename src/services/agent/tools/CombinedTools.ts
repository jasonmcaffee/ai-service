import { AiFunctionExecutor } from '../../../models/agent/aiTypes';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

export default class CombinedTools implements AiFunctionExecutor<CombinedTools>{
  private tools: AiFunctionExecutor<any>[] = [];

  registerTool(aiFunctionExecutor: AiFunctionExecutor<any>){
    this.tools.push(aiFunctionExecutor);

    //todo: each function on the aiFunctionExecutor.
    const propertyNames = Object.getOwnPropertyNames(aiFunctionExecutor);
    for(const prop in propertyNames){
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(aiFunctionExecutor), prop);
      if(descriptor && typeof aiFunctionExecutor[prop] === 'function'){
        this.addFunctionToThis(prop, aiFunctionExecutor);
      }
    }
  }

  private addFunctionToThis(functionName: string, aiFunctionExecutor: AiFunctionExecutor<any>){
    if(this[functionName]){
      throw new Error(`functionName: ${functionName} already exists`);
    }
    this[functionName] = async (...args: any[])=> {
      return aiFunctionExecutor[functionName](...args);
    }
  }

  getToolsMetadata(): ChatCompletionTool[] {
    return this.tools.map(t => t.getToolsMetadata()).flat();
  }
}
