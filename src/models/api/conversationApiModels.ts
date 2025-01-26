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
  sentByUserId: string;
  @ApiProperty()
  messageText: string;
  @ApiProperty()
  createdDate: string; // ISO format date string
}

// models/Conversation.ts
export class Conversation {
  @ApiProperty()
  conversationId: string;
  @ApiProperty()
  conversationName: string;
  @ApiProperty()
  createdDate: string;// ISO format date string
  @ApiProperty()
  messages: Message[];
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

export class GetConversationsForUserResponse {
  @ApiProperty()
  conversations: Conversation[];
}

export class HaveAINameTheConversationResponse{
  @ApiProperty()
  conversationName: string;
}

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
