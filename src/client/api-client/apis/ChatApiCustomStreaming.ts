import { ChatApi, ChatControllerStreamInferenceRequest } from './ChatApi';

export class ChatApiCustomStreaming extends ChatApi {
  /**
   * Stream a message based on a prompt with callbacks for each text chunk and the complete response.
   *
   * @param requestParameters - The parameters for the stream inference request.
   * @param onTextReceivedCallback - Callback invoked with each chunk of text received.
   * @param onResponseCompleteCallback - Callback invoked when the complete response is received.
   */
  async customChatControllerStreamInference(
    requestParameters: ChatControllerStreamInferenceRequest,
    onTextReceivedCallback: (chunk: string) => void,
    onResponseCompleteCallback: (response: string) => void
  ): Promise<void> {
    const response = await this.chatControllerStreamInferenceRaw(requestParameters);

    if (!response.raw.body) {
      throw new Error('Failed to stream response: Response body is null.');
    }

    const reader = response.raw.body.getReader();
    const decoder = new TextDecoder();
    let completeResponse = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const dataIndex = chunk.indexOf('data: ');

        if (dataIndex !== -1) {
          const jsonStr = chunk.slice(dataIndex + 6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.text) {
              onTextReceivedCallback(data.text);
              completeResponse += data.text;
            }
          } catch (e) {
            console.warn('Failed to parse JSON:', jsonStr);
          }
        }
      }

      onResponseCompleteCallback(completeResponse);
    } finally {
      reader.releaseLock();
    }
  }
}
