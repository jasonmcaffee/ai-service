import { Subject } from "rxjs";

export interface DownloadProgress {
  fileName: string;
  modelId: string;
  percentComplete: number;
  downloadSpeed: number; // in MBps
  estimatedSecondsRemaining: number;
}

/**
 * A class used in conjunction with NestJS SSE to stream download progress back to the client.
 */
export default class DownloadSSESubject {
  private readonly subject = new Subject<any>();

  constructor() {}

  sendProgress(progress: DownloadProgress) {
    const progressSignal = JSON.stringify(progress);
    this.subject.next(progressSignal);
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
    this.subject.error(error);
  }

  getSubject() {
    return this.subject;
  }
}
