import { Subject } from "rxjs";
import { wait } from '../utils/utils';

/**
 * A class used in conjunction with nextjs SSE to stream communications back to the client.
 */
export default class InferenceSSESubject{
  private readonly subject = new Subject<string>();
  constructor() {}

  sendText(text: string){
    const textSignal = JSON.stringify({ text });
    this.subject.next(textSignal);
  }

  sendStatus(statusText: string){
    const statusSignal = JSON.stringify({ status: statusText });
    this.subject.next(statusSignal);
  }

  async sendComplete(){
    const endSignal = JSON.stringify({ end: 'true' });
    this.subject.next(endSignal);
    this.subject.complete();
  }

  /**
   * Useful for cases where we start sending subject before returning.
   * e.g. on stop processing request.
   */
  async sendCompleteOnNextTick(){
    setTimeout(()=>{
      this.sendComplete();
    }, 10);
  }

  sendError(error: any){
    this.subject.error(error);
  }

  getSubject(){
    return this.subject;
  }
}
