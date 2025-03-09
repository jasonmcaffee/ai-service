import { Subject } from "rxjs";
import { uuid, wait } from '../utils/utils';
import { AiStatusUpdate } from './api/conversationApiModels';

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

  sendStatus(aiStatusUpdate: AiStatusUpdate){
    aiStatusUpdate.id = aiStatusUpdate.id ? aiStatusUpdate.id : uuid();
    const statusSignal = JSON.stringify({ status: aiStatusUpdate });
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
