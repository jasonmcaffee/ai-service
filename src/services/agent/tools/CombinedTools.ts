import { AiFunctionExecutor } from '../../../models/agent/aiTypes';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

export default class CombinedTools implements AiFunctionExecutor<CombinedTools>{
  private tools: AiFunctionExecutor<any>[] = [];

  registerTool(aiFunctionExecutor: AiFunctionExecutor<any>){
    this.tools.push(aiFunctionExecutor);

    //todo: each function on the aiFunctionExecutor.
    const propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(aiFunctionExecutor));
    for(const prop of propertyNames){
      if(typeof aiFunctionExecutor[prop] === 'function'){
        this.addAiFunctionToThis(prop, aiFunctionExecutor);
      }
    }
  }

  private addAiFunctionToThis(functionName: string, aiFunctionExecutor: AiFunctionExecutor<any>){
    // if(functionName === 'constructor'){ return; }
    if(!functionName.startsWith('ai')){ return; }
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
