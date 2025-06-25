import { Subject } from 'rxjs';

export interface IEmitAudioSSESubject{
  sendAudio: (audio: string, audioForText: string) => void;
  sendAudioOnNextTick: (audio: string, audioForText: string) => void;
  sendAudioComplete: () => void;
  sendAudioCompleteOnNextTick: () => void;
  sendText: (text: string) => void;
  sendStatus: (aiStatusUpdate: any) => void;
  sendTextComplete: () => Promise<void>;
  sendTextCompleteOnNextTick: () => Promise<void>;
  sendError: (error: any) => void;
  getSubject: () => Subject<any>;
  getStatusTopicsKeyValues?: () => any;
}
