import { AiFunctionExecutor } from '../../../models/agent/aiTypes';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Proxy for N number of AiFunctionExecutors, which allows us to combine them together and act as a single function executor.
 * Only functions that begin with 'ai' will be combined into this class.
 * Duplicate function names will result in error when combineAiFunctionExecutor is called.
 */
export default class CombinedAiFunctionExecutors implements AiFunctionExecutor<CombinedAiFunctionExecutors>{
  private tools: AiFunctionExecutor<any>[] = [];

  combineAiFunctionExecutor(aiFunctionExecutor: AiFunctionExecutor<any>){
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

  static createFrom(...executors: AiFunctionExecutor<any>[]){
    const combined = new CombinedAiFunctionExecutors();
    for(let e of executors){
      combined.combineAiFunctionExecutor(e);
    }
    return combined;
  }
}
