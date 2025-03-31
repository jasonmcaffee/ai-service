import { Subject } from "rxjs";
import { uuid, wait } from '../utils/utils';
import { AiStatusUpdate } from './api/conversationApiModels';
import { StatusTopics } from './api/StatusTopics';
import { IEmitAudioSSESubject } from './IEmitAudioSSESubject';

/**
 * A class used in conjunction with nextjs SSE to stream communications back to the client.
 */
export default class InferenceSSESubject implements IEmitAudioSSESubject{
  private readonly subject = new Subject<string>();
  private readonly statusTopics = new StatusTopics();
  private buffer: string = ""; // Buffer to store incomplete sentences

  constructor() {}

  sendAudio(audio: string) {
    const audioSignal = JSON.stringify({ audio });
    this.subject.next(audioSignal);
  }
  sendAudioComplete() {
    const endSignal = JSON.stringify({ audioEnd: true });
    this.subject.next(endSignal);
    // this.subject.complete();
  }

  sendAudioCompleteOnNextTick() {
    setTimeout(() => {
      this.sendAudioComplete();
    }, 10);
  }
  /**
   * Helper function to track received text and emit complete sentences
   * @param text The text received from the LLM
   */
  private processSentences(text: string): void {
    this.buffer += text;

    // Simple regex to find sentence boundaries
    // Matches periods, question marks, or exclamation marks followed by a space or end of string
    const sentenceRegex = /[.!?](?:\s|$)/g;

    let match;
    let lastIndex = 0;

    // Find all sentence boundaries in the current buffer
    while ((match = sentenceRegex.exec(this.buffer)) !== null) {
      // Extract the complete sentence
      const sentence = this.buffer.substring(0, match.index + 1);
      // Emit the sentence
      this.subject.next(JSON.stringify({ sentence }));
      // Update the last matched index
      lastIndex = match.index + match[0].length;
    }
    // Remove emitted sentences from buffer, keep remaining text
    if (lastIndex > 0) {
      this.buffer = this.buffer.substring(lastIndex);
    }
  }

  sendText(text: string){
    const textSignal = JSON.stringify({ text });
    this.subject.next(textSignal);

    // Process the received text for complete sentences
    this.processSentences(text);
  }

  sendStatus(aiStatusUpdate: AiStatusUpdate){
    aiStatusUpdate.topicId = aiStatusUpdate.topicId ? aiStatusUpdate.topicId : uuid();
    aiStatusUpdate.date = aiStatusUpdate.date ? aiStatusUpdate.date : Date.now();

    this.statusTopics.addAiStatusUpdate(aiStatusUpdate);
    const statusTopicsSignal =  JSON.stringify({statusTopics: {statusTopicsKeyValues:  this.statusTopics.statusTopicsKeyValues}});
    this.subject.next(statusTopicsSignal);

    // const statusSignal = JSON.stringify({ status: aiStatusUpdate });
    // this.subject.next(statusSignal);
  }

  getStatusTopicsKeyValues(){
    return this.statusTopics.statusTopicsKeyValues;
  }

  async sendTextComplete(){
    // If there's any remaining text in the buffer, emit it as a sentence
    if (this.buffer.length > 0) {
      this.subject.next(JSON.stringify({ sentence: this.buffer }));
      this.buffer = "";
    }

    const endSignal = JSON.stringify({ textEnd: 'true' });
    this.subject.next(endSignal);
    // this.subject.complete();
  }

  /**
   * Useful for cases where we start sending subject before returning.
   * e.g. on stop processing request.
   */
  async sendTextCompleteOnNextTick(){
    setTimeout(()=>{
      this.sendTextComplete();
    }, 10);
  }

  sendError(error: any){
    this.subject.error(error);
  }

  getSubject(){
    return this.subject;
  }
}
