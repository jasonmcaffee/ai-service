import { Subject } from 'rxjs';
import { IEmitAudioSSESubject } from './IEmitAudioSSESubject';

export class AudioProgress {
  text?: string;
  audio?: string;
  processingTime?: number;
}

/**
 * A class used in conjunction with NestJS SSE to stream audio processing results back to the client.
 */
export class SpeechAudioSSESubject implements IEmitAudioSSESubject{
  private readonly subject = new Subject<any>();

  constructor() {}

  sendProgress(progress: AudioProgress) {
    const progressSignal = JSON.stringify({ progress });
    this.subject.next(progressSignal);
  }

  sendText(text: string) {
    const textSignal = JSON.stringify({ text });
    this.subject.next(textSignal);
  }

  sendAudio(audio: string, audioForText: string) {
    const audioSignal = JSON.stringify({ audio, audioForText });
    this.subject.next(audioSignal);
  }

  sendAudioOnNextTick(audio: string, audioForText: string) {
    setTimeout(() => {
      this.sendAudio(audio, audioForText);
    }, 10);
  }

  sendAudioComplete() {
    const endSignal = JSON.stringify({ audioEnd: true });
    this.subject.next(endSignal);
    this.subject.complete();
  }

  sendAudioCompleteOnNextTick() {
    setTimeout(() => {
      this.sendAudioComplete();
    }, 10);
  }

  sendStatus(aiStatusUpdate: any) {
    const statusSignal = JSON.stringify({ status: aiStatusUpdate });
    this.subject.next(statusSignal);
  }

  async sendTextComplete() {
    const endSignal = JSON.stringify({ textEnd: true });
    this.subject.next(endSignal);
  }

  async sendTextCompleteOnNextTick() {
    setTimeout(() => {
      this.sendTextComplete();
    }, 10);
  }

  sendError(error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorSignal = JSON.stringify({ error: errorMessage });
    this.subject.next(errorSignal);
    this.subject.error(error);
  }

  getSubject() {
    return this.subject;
  }
}
