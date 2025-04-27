import { Injectable } from '@nestjs/common';
import InferenceSSESubject from '../models/InferenceSSESubject';
import { convertMarkdownToPlainText } from '../utils/utils';
import { SpeechAudioService } from './speechAudio.service';

@Injectable()
export class ChatAudioService {
  constructor(private readonly speechAudioService: SpeechAudioService) {}

  public handleSendingAudio(inferenceSSESubject: InferenceSSESubject, shouldRespondWithAudio: boolean, memberId: string, textToSpeechSpeed: number){
    if(!shouldRespondWithAudio){ return; }

    const pendingAudio: {index: number, sentence: string, buffer?: Buffer}[] = [];
    let nextIndexToSend = 0;
    const audioPromises: Promise<Buffer>[] = [];

    const processPendingAudio = () => {
      while (nextIndexToSend < pendingAudio.length && pendingAudio[nextIndexToSend].buffer) {
        const item = pendingAudio[nextIndexToSend];
        const base64Audio = Buffer.from(item.buffer!).toString('base64');
        // console.log(`${Date.now()} sending audio for sentence: ${item.sentence}`);
        inferenceSSESubject.sendAudioOnNextTick(base64Audio, item.sentence);
        nextIndexToSend++;
      }
    };

    let doesResponseHaveAThinkTag = false;
    let hasThinkTagEnded = false;

    inferenceSSESubject.getSubject().subscribe({
      next: async (data: string) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.sentence) {

            if(parsed.sentence.indexOf('<think>') >= 0){
              doesResponseHaveAThinkTag = true;
            }
            if(parsed.sentence.indexOf('</think>') >= 0){
              hasThinkTagEnded = true;
            }

            if(doesResponseHaveAThinkTag && !hasThinkTagEnded){
              console.log(`skipping converting text to speech because sentence is inside of a think tag.`);
              return;
            }

            const plainTextSentence = convertMarkdownToPlainText(parsed.sentence);
            console.log(`original sentence: \n${parsed.sentence} \n plainText: ${plainTextSentence}`);

            const currentIndex = pendingAudio.length;
            pendingAudio.push({index: currentIndex, sentence: plainTextSentence});

            // Create a promise that resolves when this audio is processed
            const audioPromise = this.speechAudioService.textToSpeechSync(plainTextSentence, textToSpeechSpeed)
              .then(audioBuffer => {
                // Store the buffer with its metadata
                pendingAudio[currentIndex].buffer = audioBuffer;
                // Try to send pending audio immediately after each buffer is ready
                processPendingAudio();
                return audioBuffer;
              });

            audioPromises.push(audioPromise);
          }

          if(parsed.textEnd){
            // Wait for ALL audio to be processed before sending complete
            await Promise.all(audioPromises);
            // One final check to send any remaining audio
            processPendingAudio();
            console.log(`received textEnd and all promises are complete, so no more sentence, therefore audioEnd`);
            inferenceSSESubject.sendAudioCompleteOnNextTick();
          }
        } catch (error) {
          console.error("Error parsing data:", error);
        }
      }
    });
  }
}
