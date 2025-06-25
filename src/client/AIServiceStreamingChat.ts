import { ChatApi, StatusTopicKeyValuesResponse, StreamInferenceRequest, Configuration} from './api-client';

export function base64ToAudioBlob(base64: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let i = 0; i < byteCharacters.length; i += 512) {
    const slice = byteCharacters.slice(i, i + 512);
    const byteNumbers = new Array(slice.length);

    for (let j = 0; j < slice.length; j++) {
      byteNumbers[j] = slice.charCodeAt(j);
    }

    //@ts-ignore
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: mimeType });
}

const clientConfig = new Configuration({basePath: 'http://localhost:3000'});

/**
 * We have to implement a custom ChatApi that uses SSE EventSource, since openAPI doesn't support generating clients with SSE.
 */
export class AIServiceStreamingChat extends ChatApi {
  constructor() {
    super(clientConfig);
  }

  async stopChatProcessing(){
    try{
      await this.stop();
    }catch (e){
      console.error('error trying to stopChatProcessing: ', e);
    }
  }

  async streamInferenceSSE(
    request: StreamInferenceRequest,
    onTextReceivedCallback: (chunk: string) => void,
    onResponseCompleteCallback: (response: string) => void,
    onStatusTopicsReceivedCallback: (statusTopicsKeyValues: StatusTopicKeyValuesResponse) => void,
    onAudioReceived: (audio: Blob) => Promise<void>,
    onAudioCompleted: () => void,
  ): Promise<void> {

    const params = new URLSearchParams({
      prompt: request.prompt,
      conversationId: request.conversationId || '',
      shouldSearchWeb: request.shouldSearchWeb.toString(),
      shouldUsePlanTool: request.shouldUsePlanTool.toString(),
      shouldRespondWithAudio: request.shouldRespondWithAudio.toString(),
      textToSpeechSpeed: request.textToSpeechSpeed.toString(),
      shouldUseAgentOfAgents: request.shouldUseAgentOfAgents.toString(),
      temperature: request.temperature.toString(),
      top_p: request.topP.toString(),
      frequency_penalty: request.frequencyPenalty.toString(),
      presence_penalty: request.presencePenalty.toString(),
      imageUrl: request.imageUrl? encodeURIComponent(request.imageUrl) : '',
    }).toString();

    const url = `${this.configuration.basePath}/chat/streamInference?${params}`;

    const eventSource = new EventSource(url, {});
    let completeResponse = '';
    let hasReceivedTextEnd = false;
    let hasReceivedAudioEnd = false;
    eventSource.addEventListener('open', () => {
      console.log('SSE connection opened');
    });

    eventSource.addEventListener('message', async (event:any) => {
      const jsonData = JSON.parse(event.data);
      const text = jsonData.text;
      if(text){
        onTextReceivedCallback(text);
        completeResponse += text;
      }
      if(jsonData.textEnd){
        hasReceivedTextEnd = true;
      }
      if(jsonData.audioEnd){
        hasReceivedAudioEnd = true;
      }

      if(hasReceivedTextEnd && !request.shouldRespondWithAudio){
        console.log(`received text end and dont expect audio. disconnecting.`)
        disconnect();
      }

      if(hasReceivedTextEnd && hasReceivedAudioEnd){
        console.log(`received both text and audio end. disconnecting.`);
        disconnect();
      }

      if(hasReceivedAudioEnd){
        onAudioCompleted();
      }

      if(jsonData.statusTopics){
        onStatusTopicsReceivedCallback(jsonData.statusTopics as StatusTopicKeyValuesResponse);
      }
      if (jsonData.audio) {
        console.log(`chat received audio! for text: ${jsonData.audioForText}`);
        const audioBlob = base64ToAudioBlob(jsonData.audio, 'audio/mpeg');
        await onAudioReceived(audioBlob);
      }
    });

    eventSource.addEventListener('error', (event: any) => {
      console.error('SSE error:', event);
      disconnect();
    });

    function disconnect() {
      if (eventSource) {
        console.log('SSE connection closed');
        eventSource.close();
        onResponseCompleteCallback(completeResponse);

      }
    }
  }
}
