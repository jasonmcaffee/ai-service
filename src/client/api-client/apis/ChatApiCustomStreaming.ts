import { ChatApi, StreamInferenceRequest } from './ChatApi';
import js from '@eslint/js';
const EventSource = require('eventsource').EventSource;

// let SSEClient;
// if (typeof window !== 'undefined' && window.EventSource) {
//   // Web browser
//   SSEClient = window;
// } else if (typeof global !== 'undefined' && global.EventSource){
//   SSEClient = global;
// } else if (typeof require !== 'undefined') {
//   SSEClient = require('eventsource');
// }
//
// const EventSource = SSEClient.EventSource;

export class ChatApiCustomStreaming extends ChatApi {
  async customChatControllerStreamInferenceV2(
    requestParameters: StreamInferenceRequest,
    onTextReceivedCallback: (chunk: string) => void,
    onResponseCompleteCallback: (response: string) => void
  ): Promise<void> {
    const prompt = requestParameters.prompt;
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${this.configuration.basePath}/chat/streamInference?prompt=${encodedPrompt}`;

    console.log(`url is: ${url}`);
    const eventSource = new EventSource(url);
    let completeResponse = '';

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.onmessage = (event: MessageEvent) => {
      // console.log('Received data:', event.data);
      // Handle the received data here
      const jsonData = JSON.parse(event.data);
      if(jsonData.text){
        onTextReceivedCallback(jsonData.text);
        completeResponse += jsonData.text;
      }
      if(jsonData.end){
        disconnect();
      }
    };

    eventSource.onerror = (error) => {
      // console.error('SSE error:', error);
      disconnect();
    };

    function disconnect() {
      if (eventSource) {
        eventSource.close();
        onResponseCompleteCallback(completeResponse);
        console.log('SSE connection closed');
      }
    }

  }
}
//
// export class ChatApiCustomStreaming extends ChatApi {
//   /**  THIS WORKS BUT YOU HAVE TO HAVE THE SERVER STRINGIFY the response {text: "blah"} which is weird.
//    * Stream a message based on a prompt with callbacks for each text chunk and the complete response.
//    *
//    * @param requestParameters - The parameters for the stream inference request.
//    * @param onTextReceivedCallback - Callback invoked with each chunk of text received.
//    * @param onResponseCompleteCallback - Callback invoked when the complete response is received.
//    */
//   async customChatControllerStreamInference(
//     requestParameters: ChatControllerStreamInferenceRequest,
//     onTextReceivedCallback: (chunk: string) => void,
//     onResponseCompleteCallback: (response: string) => void
//   ): Promise<void> {
//     const response = await this.chatControllerStreamInferenceRaw(requestParameters);
//
//     if (!response.raw.body) {
//       throw new Error('Failed to stream response: Response body is null.');
//     }
//
//     const reader = response.raw.body.getReader();
//     const decoder = new TextDecoder();
//     let completeResponse = '';
//
//     try {
//       while (true) {
//         const { value, done } = await reader.read();
//         if (done) break;
//
//         const chunk = decoder.decode(value);
//         const dataIndex = chunk.indexOf('data: ');
//
//         if (dataIndex !== -1) {
//           const jsonStr = chunk.slice(dataIndex + 6);
//           try {
//             const data = JSON.parse(jsonStr);
//             if (data.text) {
//               onTextReceivedCallback(data.text);
//               completeResponse += data.text;
//             }
//           } catch (e) {
//             console.warn('Failed to parse JSON:', jsonStr); //TODO THIS FIRES WITH end: true
//           }
//         }
//       }
//
//       onResponseCompleteCallback(completeResponse);
//     } finally {
//       reader.releaseLock();
//     }
//   }
// }
