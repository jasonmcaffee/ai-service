import { ApiProperty } from '@nestjs/swagger';

export class Member {
  @ApiProperty()
  userId: string;
  @ApiProperty()
  userName: string;
}

export class ModelOrDatasource {
  @ApiProperty()
  id: string;
  @ApiProperty()
  type: "model" | "datasource";
}

export class MessageContext {
  @ApiProperty()
  textWithoutTags: string;
  @ApiProperty()
  originalText: string;
  @ApiProperty({type: [ModelOrDatasource]})
  models: ModelOrDatasource[];
  @ApiProperty({type: [ModelOrDatasource]})
  datasources: ModelOrDatasource[];
}

export class Image {
  @ApiProperty()
  imageFileName: string;
  @ApiProperty()
  promptUsedToCreateImage: string;
  @ApiProperty()
  height: number;
  @ApiProperty()
  width: number;
  @ApiProperty()
  memberId: string;
  @ApiProperty()
  createdDate: string;
  @ApiProperty()
  promptId: string;
}

export class CreateImage {
  @ApiProperty()
  imageFileName: string;
  @ApiProperty()
  promptUsedToCreateImage: string;
  @ApiProperty()
  height: number;
  @ApiProperty()
  width: number;
  @ApiProperty()
  promptId: string;
}

export class PagedImages {
  @ApiProperty()
  pageNumber: number;
  @ApiProperty()
  numberOfImagesPerPage: number;
  @ApiProperty()
  remainingPages: number;
  @ApiProperty()
  remainingImages: number;
  @ApiProperty({type: [Image]})
  images: Image[]
}

export class Message {
  @ApiProperty()
  messageId: string;
  @ApiProperty()
  sentByMemberId: string;
  @ApiProperty()
  messageText: string;
  @ApiProperty()
  createdDate: string; // ISO format date string
  @ApiProperty()
  role: string; //user, system
  @ApiProperty({nullable: true})
  messageContext?: MessageContext; //not sent back yet, but want to force including the type in openapi-spec.
}

export class CreateMessage {
  @ApiProperty()
  messageText: string;
  @ApiProperty()
  role: string;
}


export class DatasourceType {
  @ApiProperty()
  id: number;

  @ApiProperty()
  datasourceType: string;
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

  @ApiProperty({type: [Document], nullable: true})
  documents?: Document[]

  @ApiProperty({nullable: true})
  dateAddedToConversation?: string;// from created_date of conversation_datasource.
}

export class PollImageStatusResponse {
  @ApiProperty()
  imageName: string;
}

export class UpscaleImageRequest {
  @ApiProperty()
  imageName: string;
}

export class GenerateAiImageRequest {
  @ApiProperty()
  height: number;
  @ApiProperty()
  width: number;
  @ApiProperty()
  prompt: string;
  @ApiProperty()
  prefix: string;
}

export class GenerateAiImageResponse{
  @ApiProperty()
  promptId: string;
}

export class GenerateAndReturnAiImageResponse{
  @ApiProperty()
  data: string;
  @ApiProperty()
  mimeType: string;
  @ApiProperty()
  promptId: string;
  @ApiProperty()
  prompt: string;
}

export class Conversation {
  @ApiProperty()
  conversationId: string;
  @ApiProperty()
  conversationName: string;
  @ApiProperty()
  createdDate: string;// ISO format date string
  @ApiProperty({ type: [Message], nullable: true })
  messages?: Message[];
  @ApiProperty({ type: [Datasource], nullable: true })
  datasources?: Datasource[]
}

export class CreateConversation {
  @ApiProperty()
  conversationName: string;
}

export class ModelType {
  @ApiProperty()
  id: number;
  @ApiProperty()
  modelType: string;
}

export class Model {
  @ApiProperty()
  id: string;
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  apiKey: string;
  @ApiProperty()
  modelName: string;
  @ApiProperty()
  isDefault: boolean;
  @ApiProperty()
  modelTypeId: number;
  @ApiProperty()
  initialMessage?: string; //initial message to send to the llm. aka persona
}

export class CreateModel {
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  apiKey: string;
  @ApiProperty()
  modelName: string;
  @ApiProperty()
  isDefault: boolean;
  @ApiProperty()
  modelTypeId: number;
  @ApiProperty()
  initialMessage?: string; //initial message to send to the llm. aka persona
}

export class UpdateModel {
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  apiKey: string;
  @ApiProperty()
  modelName: string;
  @ApiProperty()
  isDefault: boolean;
  @ApiProperty()
  modelTypeId: number;
  @ApiProperty()
  initialMessage?: string; //initial message to send to the llm. aka persona
}

export class Suggestion {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  type: string;
}

export class GetAutoCompleteSuggestionsRequest {
  @ApiProperty()
  text: string;
}


export class CreateDatasource {
  @ApiProperty()
  datasourceTypeId: number;

  @ApiProperty()
  name: string;
}

export class CreateDocument {
  @ApiProperty()
  base64String: string;

  @ApiProperty()
  fileName: string;
}

export class ChatInference {
  @ApiProperty()
  prompt: string;
}

export class SearchResult {
  @ApiProperty()
  title: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  blurb: string;
}

export class SearchResultWithMarkdownOfPage {
  @ApiProperty()
  title: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  blurb: string;
  @ApiProperty()
  markdown: string;
}



export class SearchResultResponse{
  @ApiProperty()
  query: string;
  @ApiProperty({type: [SearchResult]})
  searchResults: SearchResult[];
}

export class SearchResultWithMarkdownContentResponse{
  @ApiProperty()
  query: string;
  @ApiProperty({type: [SearchResultWithMarkdownOfPage]})
  searchResults: SearchResultWithMarkdownOfPage[];
}

export class GetPageContentsResponse {
  @ApiProperty()
  markdown: string;
  @ApiProperty()
  wordCount: number;
  @ApiProperty()
  tokenCount: number;
}

export class AiStatusUpdate {
  @ApiProperty()
  topicId?: string; //for streaming/updates
  @ApiProperty()
  topic: 'planningAndExecuting' | 'planning' | 'executing' | 'reasoning' | 'web' | 'responding';
  @ApiProperty()
  data?: object;
  @ApiProperty()
  displayText?: string;
  // @ApiProperty()
  // streamable?: boolean;
  @ApiProperty()
  isError?: boolean;
  @ApiProperty()
  topicCompleted?: boolean; //lets the ui know that this set of work is complete.
}
