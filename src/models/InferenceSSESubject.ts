import { Subject } from "rxjs";
import { uuid, wait } from '../utils/utils';
import { AiStatusUpdate } from './api/conversationApiModels';
import { StatusTopics } from './api/StatusTopics';

/**
 * A class used in conjunction with nextjs SSE to stream communications back to the client.
 */
export default class InferenceSSESubject{
  private readonly subject = new Subject<string>();
  private readonly statusTopics = new StatusTopics();
  constructor() {}

  sendText(text: string){
    const textSignal = JSON.stringify({ text });
    this.subject.next(textSignal);
  }

  sendStatus(aiStatusUpdate: AiStatusUpdate){
    aiStatusUpdate.topicId = aiStatusUpdate.topicId ? aiStatusUpdate.topicId : uuid();
    aiStatusUpdate.date = aiStatusUpdate.date ? aiStatusUpdate.date : Date.now();

    this.statusTopics.addAiStatusUpdate(aiStatusUpdate);
    const statusTopicsSignal =  JSON.stringify({statusTopics: {statusTopicsKeyValues:  this.statusTopics.statusTopicsKeyValues}});
    this.subject.next(statusTopicsSignal);

    const statusSignal = JSON.stringify({ status: aiStatusUpdate });
    this.subject.next(statusSignal);
  }

  getStatusTopicsKeyValues(){
    return this.statusTopics.statusTopicsKeyValues;
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
