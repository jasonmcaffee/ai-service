import { ChatApi, ChatControllerStreamInferenceRequest } from './ChatApi';

//Manually created class for streaming responses from chat.
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

    if (response.raw.body) {
      const reader = response.raw.body.getReader();
      const decoder = new TextDecoder();
      let completeResponse = '';
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const rawChunk = decoder.decode(value, { stream: true });

          // Split by newlines to handle potential multi-line chunks
          const lines = rawChunk.split('\n');

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Ignore empty lines or control lines
            if (!trimmedLine || !trimmedLine.startsWith('data:')) {
              continue;
            }

            // Extract the actual data payload
            const data = trimmedLine.replace(/^data:\s*/, '');
            completeResponse += data;

            // Invoke the chunk callback
            onTextReceivedCallback(data);
          }
        }
      }

      // Invoke the complete response callback
      onResponseCompleteCallback(completeResponse);
    } else {
      throw new Error('Failed to stream response: Response body is null.');
    }
  }
}
