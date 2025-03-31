import { Subject } from 'rxjs';

export interface IEmitAudioSSESubject{
  sendAudio: (audio: string) => void;
  sendAudioComplete: () => void;
  sendAudioCompleteOnNextTick: () => void;
  sendError: (error: any) => void;
  getSubject: () => Subject<any>;
}
