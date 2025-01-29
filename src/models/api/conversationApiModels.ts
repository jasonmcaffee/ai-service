import { ApiProperty } from '@nestjs/swagger';

// models/User.ts
export class User {
  @ApiProperty()
  userId: string;
  @ApiProperty()
  userName: string;
}

// models/Message.ts
export class Message {
  @ApiProperty()
  messageId: string;
  @ApiProperty()
  sentByMemberId: string;
  @ApiProperty()
  messageText: string;
  @ApiProperty()
  createdDate: string; // ISO format date string
}

export class CreateMessage {
  @ApiProperty()
  messageText: string;
}

// models/Conversation.ts
export class Conversation {
  @ApiProperty()
  conversationId: string;
  @ApiProperty()
  conversationName: string;
  @ApiProperty()
  createdDate: string;// ISO format date string
  @ApiProperty({ type: [Message], nullable: true })
  messages?: Message[];
}

export class CreateConversation {
  @ApiProperty()
  conversationName: string;
}

// models/StartConversationResponse.ts
export class StartConversationResponse {
  @ApiProperty()
  conversationId: string;
  @ApiProperty()
  conversationName: string;
  @ApiProperty()
  createdDate: string;
}

// models/AddMessageResponse.ts
export class AddMessageResponse {
  @ApiProperty()
  messages: Message[];
}

// models/GetConversationResponse.ts
export class GetConversationResponse {
  @ApiProperty()
  conversationId: string;
  @ApiProperty()
  conversationName: string;
  @ApiProperty()
  messages: Message[];
}

export class GetConversationsForMemberResponse {
  @ApiProperty()
  conversations: Conversation[];
}

// export class HaveAINameTheConversationRequest{
//   @ApiProperty()
//   conversationName: string;
// }

// export class HaveAINameTheConversationResponse{
//   @ApiProperty()
//   conversationName: string;
// }

export class Suggestion {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  type: string;
}

export class GetAtAutoCompleteSuggestionsResponse {
  @ApiProperty()
  suggestions: Suggestion[];
}

export class DatasourceType {
  @ApiProperty()
  id: number;

  @ApiProperty()
  datasourceType: string;
}

export class Datasource {
  @ApiProperty()
  id: number;

  @ApiProperty()
  pathToChromaFile: string;

  @ApiProperty()
  createdDate: string; // ISO format date string

  @ApiProperty()
  datasourceTypeId: number;

  @ApiProperty()
  name: string;
}

export class CreateDatasource {
  @ApiProperty()
  datasourceTypeId: number;

  @ApiProperty()
  name: string;
}

export class Document {
  @ApiProperty()
  id: number;

  @ApiProperty()
  createDate: string; // ISO format date string

  @ApiProperty()
  updatedDate: string; // ISO format date string

  @ApiProperty()
  text: string;

  @ApiProperty()
  metadata: object; // JSONB

  @ApiProperty()
  filePath: string;
}

export class CreateDocument {
  @ApiProperty()
  text: string;

  // @ApiProperty()
  // datasourceId: number;
}

export class DatasourceDocument {
  @ApiProperty()
  datasourceId: number;

  @ApiProperty()
  documentId: number;

  @ApiProperty()
  lastVectorBuildDate: string; // ISO format date string
}

export class ConversationDatasource {
  @ApiProperty()
  conversationId: string;

  @ApiProperty()
  datasourceId: number;
}

export class ChatInference {
  @ApiProperty()
  prompt: string;
}
