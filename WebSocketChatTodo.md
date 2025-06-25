# WebSocket Chat Implementation Plan

## Overview
This plan outlines the implementation of a WebSocket version of the `streamInference` endpoint that perfectly mirrors the existing SSE (Server-Sent Events) behavior. The WebSocket implementation will provide the same functionality as the SSE endpoint but with bidirectional communication capabilities.

## Current Architecture Analysis

### Existing SSE Implementation
- **Controller**: `src/controllers/chat.controller.ts` - `streamInference` method with `@Sse()` decorator
- **Service**: `src/services/chat.service.ts` - `streamInference` method returns RxJS Observable
- **Client**: `src/client/AIServiceStreamingChat.ts` - `streamInferenceSSE` method using EventSource
- **Subject**: `src/models/InferenceSSESubject.ts` - Handles streaming data with methods like `sendText`, `sendAudio`, `sendTextComplete`, etc.
- **Test**: `src/test/client.spec.ts` - Tests SSE functionality

### WebSocket Infrastructure
- **Existing Gateway**: `src/gateways/speechToText.gateway.ts` - Example WebSocket implementation using Socket.io
- **Dependencies**: Already installed - `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`

## Implementation Plan

### Phase 1: Create WebSocket Gateway

#### 1.1 Create Chat WebSocket Gateway
**File**: `src/gateways/chat.gateway.ts`

**Tasks**:
- [ ] Create new WebSocket gateway class `ChatGateway`
- [ ] Implement `OnGatewayConnection` and `OnGatewayDisconnect` interfaces
- [ ] Add CORS configuration matching existing SSE setup
- [ ] Add authentication handling similar to `SpeechToTextGateway`
- [ ] Create client-to-member mapping for connection management
- [ ] Add connection logging and error handling

#### 1.2 Implement WebSocket Message Handler
**Tasks**:
- [ ] Create `@SubscribeMessage('streamInference')` handler
- [ ] Parse incoming `StreamInferenceRequest` from WebSocket message
- [ ] Validate all required parameters (prompt, shouldSearchWeb, etc.)
- [ ] Handle parameter type conversion (string to boolean/number)
- [ ] Call existing `ChatService.streamInference` method
- [ ] Subscribe to the returned Observable and forward events to WebSocket client

### Phase 2: Update Client Implementation

#### 2.1 Add WebSocket Client Method
**File**: `src/client/AIServiceStreamingChat.ts`

**Tasks**:
- [ ] Add new method `streamInferenceWS` with identical signature to `streamInferenceSSE`
- [ ] Import Socket.io client library
- [ ] Implement WebSocket connection establishment
- [ ] Send `StreamInferenceRequest` as WebSocket message
- [ ] Handle incoming WebSocket messages and parse JSON data
- [ ] Call appropriate callbacks: `onTextReceivedCallback`, `onResponseCompleteCallback`, etc.
- [ ] Implement connection cleanup and error handling
- [ ] Add reconnection logic if needed
- [ ] Ensure identical behavior to SSE implementation

#### 2.2 Add WebSocket Dependencies
**Tasks**:
- [ ] Add `socket.io-client` to package.json dependencies
- [ ] Add `@types/socket.io-client` to devDependencies if needed
- [ ] Update import statements in client file

### Phase 3: Update Server Configuration

#### 3.1 Register WebSocket Gateway
**File**: `src/app.module.ts`

**Tasks**:
- [ ] Ensure `ChatGateway` is included in the dynamic module loading
- [ ] Verify gateway is properly registered in the providers array
- [ ] Test that gateway loads correctly on application startup

#### 3.2 Update Main Application
**File**: `src/main.ts`

**Tasks**:
- [ ] Verify WebSocket adapter is properly configured
- [ ] Ensure CORS settings allow WebSocket connections
- [ ] Test WebSocket endpoint accessibility

### Phase 4: Create Comprehensive Tests

#### 4.1 Create WebSocket Test
**File**: `src/test/client.spec.ts`

**Tasks**:
- [ ] Add new test suite `describe('Chat with WebSocket')`
- [ ] Create test case that mirrors existing SSE test exactly
- [ ] Use same test data and expectations as SSE test
- [ ] Test all callback functions: text received, response complete, status topics, audio received, audio completed
- [ ] Test error handling and connection cleanup
- [ ] Ensure test timeout matches SSE test (15000ms)
- [ ] Add WebSocket-specific connection testing

#### 4.2 Create Integration Tests
**Tasks**:
- [ ] Test WebSocket connection establishment
- [ ] Test message sending and receiving
- [ ] Test connection cleanup on completion
- [ ] Test error scenarios and recovery
- [ ] Test concurrent connections
- [ ] Test authentication and authorization

### Phase 5: Documentation and API Updates

#### 5.1 Update OpenAPI Specification
**File**: `src/openapi-spec.json`

**Tasks**:
- [ ] Add WebSocket endpoint documentation
- [ ] Document WebSocket message format
- [ ] Add WebSocket connection parameters
- [ ] Include authentication requirements
- [ ] Document error responses and handling

#### 5.2 Update API Client Generation
**Tasks**:
- [ ] Regenerate API client if needed
- [ ] Ensure WebSocket types are properly generated
- [ ] Update client documentation

### Phase 6: Validation and Testing

#### 6.1 Functional Testing
**Tasks**:
- [ ] Test WebSocket endpoint with all parameter combinations
- [ ] Verify identical behavior to SSE endpoint
- [ ] Test audio streaming functionality
- [ ] Test status topic updates
- [ ] Test error handling and recovery
- [ ] Test connection stability and cleanup

#### 6.2 Performance Testing
**Tasks**:
- [ ] Compare WebSocket vs SSE performance
- [ ] Test with multiple concurrent connections
- [ ] Test with large response payloads
- [ ] Monitor memory usage and cleanup

#### 6.3 Cross-Platform Testing
**Tasks**:
- [ ] Test on different browsers
- [ ] Test with different WebSocket client libraries
- [ ] Test connection stability across network conditions

## Technical Implementation Details

### WebSocket Message Format
```json
{
  "event": "streamInference",
  "data": {
    "prompt": "string",
    "conversationId": "string",
    "shouldSearchWeb": boolean,
    "shouldUsePlanTool": boolean,
    "shouldRespondWithAudio": boolean,
    "textToSpeechSpeed": number,
    "shouldUseAgentOfAgents": boolean,
    "temperature": number,
    "topP": number,
    "frequencyPenalty": number,
    "presencePenalty": number,
    "imageUrl": "string"
  }
}
```

### WebSocket Response Format
```json
{
  "text": "string",
  "textEnd": boolean,
  "audio": "base64string",
  "audioForText": "string",
  "audioEnd": boolean,
  "statusTopics": {
    "statusTopicsKeyValues": {}
  }
}
```

### Error Handling
- Connection errors should trigger `onResponseCompleteCallback` with error information
- Invalid requests should return error messages via WebSocket
- Network disconnections should be handled gracefully
- Authentication failures should close connection with appropriate error

### Authentication
- Use same authentication mechanism as existing SSE endpoint
- Extract member ID from authentication service
- Validate user permissions before processing requests
- Handle authentication errors appropriately

## Dependencies and Requirements

### Server Dependencies (Already Installed)
- `@nestjs/websockets`: ^11.0.12
- `@nestjs/platform-socket.io`: ^11.0.12
- `socket.io`: ^4.8.1

### Client Dependencies (To Add)
- `socket.io-client`: Latest version
- `@types/socket.io-client`: Latest version (if needed)

### Configuration Requirements
- CORS settings to allow WebSocket connections
- WebSocket adapter configuration in main.ts
- Proper error handling and logging
- Connection timeout and cleanup settings

## Success Criteria

1. **Functional Parity**: WebSocket implementation behaves identically to SSE implementation
2. **Performance**: WebSocket performance is comparable to or better than SSE
3. **Reliability**: WebSocket connections are stable and handle errors gracefully
4. **Test Coverage**: All SSE functionality is tested in WebSocket implementation
5. **Documentation**: Clear documentation for WebSocket usage and API
6. **Backward Compatibility**: Existing SSE functionality remains unchanged

## Risk Mitigation

1. **Connection Stability**: Implement reconnection logic and connection monitoring
2. **Error Handling**: Comprehensive error handling for all failure scenarios
3. **Performance**: Monitor WebSocket performance and optimize if needed
4. **Testing**: Thorough testing across different environments and conditions
5. **Rollback Plan**: Ability to disable WebSocket functionality if issues arise

## Timeline Estimate

- **Phase 1**: 2-3 days (Gateway and Subject implementation)
- **Phase 2**: 1-2 days (Client implementation)
- **Phase 3**: 0.5 days (Server configuration)
- **Phase 4**: 2-3 days (Testing implementation)
- **Phase 5**: 1 day (Documentation)
- **Phase 6**: 2-3 days (Validation and testing)

**Total Estimated Time**: 8-12 days

## Notes

- The WebSocket implementation should be an additional option, not a replacement for SSE
- Both implementations should coexist and be independently testable
- The WebSocket implementation should leverage existing business logic in `ChatService`
- All existing functionality should remain unchanged
- The implementation should follow NestJS best practices and patterns 