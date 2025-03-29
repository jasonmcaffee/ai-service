
import { Subject } from 'rxjs';

export class AudioProgress {
  text?: string;
  audio?: string;
  processingTime?: number;
}

/**
 * A class used in conjunction with NestJS SSE to stream audio processing results back to the client.
 */
export class SpeechAudioSSESubject {
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

  sendAudio(audio: string) {
    const audioSignal = JSON.stringify({ audio });
    this.subject.next(audioSignal);
  }

  sendComplete() {
    const endSignal = JSON.stringify({ end: true });
    this.subject.next(endSignal);
    this.subject.complete();
  }

  sendCompleteOnNextTick() {
    setTimeout(() => {
      this.sendComplete();
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
