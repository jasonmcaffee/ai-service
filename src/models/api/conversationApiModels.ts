import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

export class Member {
  @ApiProperty()
  userId: string;
  @ApiProperty()
  userName: string;
}

export class ModelOrDatasourceOrPromptOrAgent {
  @ApiProperty()
  id: string;
  @ApiProperty()
  type: "model" | "datasource" | "prompt" | "agent";
}

export class MessageContext {
  @ApiProperty()
  textWithoutTags: string;
  @ApiProperty()
  originalText: string;
  @ApiProperty({type: [ModelOrDatasourceOrPromptOrAgent]})
  models: ModelOrDatasourceOrPromptOrAgent[];
  @ApiProperty({type: [ModelOrDatasourceOrPromptOrAgent]})
  datasources: ModelOrDatasourceOrPromptOrAgent[];
  @ApiProperty({type: [ModelOrDatasourceOrPromptOrAgent]})
  prompts: ModelOrDatasourceOrPromptOrAgent[];
  @ApiProperty({type: [ModelOrDatasourceOrPromptOrAgent]})
  agents: ModelOrDatasourceOrPromptOrAgent[];
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

/**
 * Object structure to replace Map<string, StatusTopic>
 * Keys are topicIds, values are StatusTopic objects
 */
export class StatusTopicKeyValues {
  [topicId: string]: StatusTopic; //Record<string, StatusTopic>; should be the same thing
}

export type StatusUpdateTopicType = 'planningAndExecuting' | 'planning' | 'executing' | 'reasoning' | 'web' | 'responding' | 'agent';

export class AiStatusUpdate {
  @ApiProperty()
  topicId?: string; //for streaming/updates
  @ApiProperty()
  topic: StatusUpdateTopicType;
  @ApiProperty()
  data?: object | AiStatusSearchResultsData;
  @ApiProperty()
  displayText?: string;
  @ApiProperty()
  isError?: boolean;
  @ApiProperty()
  topicCompleted?: boolean; //lets the ui know that this set of work is complete.
  @ApiProperty()
  date?: number;
  @ApiProperty()
  timeTakenInMs?: number;
}


/**
 * Update the StatusTopic interface to use the new object structure for childStatusTopics
 */
export class StatusTopic {
  @ApiProperty({type: [AiStatusUpdate]})
  statusUpdates: AiStatusUpdate[];
  @ApiProperty()
  isTopicOpen?: boolean;
  @ApiProperty()
  dateOfLastStatusUpdate?: number;
  // @ApiProperty()
  // lastAiStatusUpdate?: AiStatusUpdate;
  @ApiProperty()
  childStatusTopics?: StatusTopicKeyValues; // Changed from childStatusTopicMap to childStatusTopics
}


export class Message {
  @ApiProperty()
  messageId: string;
  @ApiProperty()
  sentByMemberId: string;
  @ApiProperty({nullable: true})
  messageText: string;
  @ApiProperty({nullable: true})
  imageUrl?: string;
  @ApiProperty({nullable: true})
  toolCallsJson: string | undefined;
  @ApiProperty()
  createdDate: string; // ISO format date string
  @ApiProperty()
  role: string; //user, system
  @ApiProperty({nullable: true})
  messageContext?: MessageContext; //not sent back yet, but want to force including the type in openapi-spec.
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: { $ref: getSchemaPath(StatusTopic) }, // Correctly references StatusTopic
  })
  statusTopicsKeyValues?: Record<string, StatusTopic>;
}

export class CreateMessage {
  @ApiProperty()
  messageText: string;
  @ApiProperty({nullable: true})
  imageUrl: string | undefined;
  @ApiProperty({nullable: true})
  toolCallsJson: string | undefined;
  @ApiProperty()
  role: string;
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: { $ref: getSchemaPath(StatusTopic) }, // Correctly references StatusTopic
  })
  statusTopicsKeyValues?: Record<string, StatusTopic>; //todo: don't allow this from endpoints/controllers.  just internal after message is created.
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
  @ApiProperty({nullable: true})
  filePath?: string;
  @ApiProperty({nullable: true})
  contextSize?: number;
  @ApiProperty({nullable: true})
  isCurrentlyRunningOnLlamaCpp?: boolean;
  @ApiProperty({nullable: true})
  additionalLlamacppServerParams?: string;
  @ApiProperty({nullable: true})
  prependNoThinkTagToBeginningOfEachMessage?: boolean;
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
  @ApiProperty({nullable: true})
  initialMessage?: string; //initial message to send to the llm. aka persona
  @ApiProperty({nullable: true})
  filePath?: string;
  @ApiProperty({nullable: true})
  contextSize?: number;
  @ApiProperty({nullable: true})
  additionalLlamacppServerParams?: string;
  @ApiProperty({nullable: true})
  prependNoThinkTagToBeginningOfEachMessage?: boolean;
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
  @ApiProperty({nullable: true})
  initialMessage?: string; //initial message to send to the llm. aka persona
  @ApiProperty({nullable: true})
  filePath?: string;
  @ApiProperty({nullable: true})
  contextSize?: number;
  @ApiProperty({nullable: true})
  additionalLlamacppServerParams?: string;
  @ApiProperty({nullable: true})
  prependNoThinkTagToBeginningOfEachMessage?: boolean;
}

export class HFModelSibling {
  @ApiProperty()
  rfilename: string; //phi-2.Q2_K.gguf
}
export class HFModel {
  // @ApiProperty()
  // _id: string; //"6580aa20419afba19a692cc8", //duplicate identifier "id" on client. underscore ignored.
  @ApiProperty()
  id: string; // "TheBloke/phi-2-GGUF",
  @ApiProperty()
  name: string;
  // private: boolean;
  @ApiProperty()
  modelId: string; // "TheBloke/phi-2-GGUF"
  @ApiProperty()
  tags: string[]; //"tags": [ "transformers", "gguf","phi-msft","nlp","code","text-generation","en","base_model:microsoft/phi-2","base_model:quantized:microsoft/phi-2","license:other","region:us"],
  @ApiProperty()
  pipeline_tag:string; // "text-generation",
  @ApiProperty()
  library_name: string; // "transformers",
  @ApiProperty()
  createdAt: string; // "2023-12-18T20:22:56.000Z",
  @ApiProperty()
  downloads: number; // 5004057,
  @ApiProperty()
  likes: number; //197

  @ApiProperty({type: [HFModelSibling]})
  siblings: HFModelSibling[]
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

export class AiStatusSearchResultWebUrl {
  @ApiProperty()
  url: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  blurb: string;
}

export class AiStatusSearchResultsData {
  @ApiProperty({type: [AiStatusSearchResultWebUrl]})
  webUrls: AiStatusSearchResultWebUrl[];
}

@ApiExtraModels(StatusTopic) // Required to reference StatusTopic properly in OpenAPI
export class StatusTopicKeyValuesResponse {
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(StatusTopic) }, // Correctly references StatusTopic
  })
  statusTopicsKeyValues: Record<string, StatusTopic>;
}


export class MemberPrompt {
  @ApiProperty()
  id: string;

  @ApiProperty()
  promptName: string;

  @ApiProperty()
  memberId: string;

  @ApiProperty()
  promptText: string;
}

export class CreateMemberPrompt {
  @ApiProperty()
  promptName: string;

  @ApiProperty()
  promptText: string;
}

export class UpdateMemberPrompt {
  @ApiProperty({ required: false })
  promptName: string;

  @ApiProperty({ required: false })
  promptText: string;
}


export class DownloadProgress {
  @ApiProperty()
  fileName: string;
  @ApiProperty()
  modelId: string;
  @ApiProperty()
  percentComplete: number;
  @ApiProperty()
  downloadSpeed: number; // in MBps
  @ApiProperty()
  estimatedSecondsRemaining: number;
}

export class LlmFile {
  @ApiProperty()
  fileName: string;
  @ApiProperty()
  filePath: string;
  @ApiProperty()
  fileSizeGB: number;
  @ApiProperty()
  createdDate: string;
}
export class LlamaCppModelsDataMeta{
  @ApiProperty()
  vocab_type: number; // 2
  @ApiProperty()
  n_vocab: number; // 152064
  @ApiProperty()
  n_ctx_train: number; //32768
  @ApiProperty()
  n_embd: number; //5120
  @ApiProperty()
  n_params: number; //14770033664  (14 B)
  @ApiProperty()
  size: number; //12118716416 (12 GB)
}

export class LlamaCppModelsData {
  @ApiProperty()
  id: string; // e.g. "C:\\shared-drive\\llm_models\\Qwen2.5-Coder-14B-Instruct-Q6_K.gguf"
  @ApiProperty()
  object: string; //model
  @ApiProperty()
  created: number; //1742410197;
  @ApiProperty()
  owned_by: string; //llamacpp
  @ApiProperty()
  meta: LlamaCppModelsDataMeta;
}

export class LlamaCppModelsResponse {
  @ApiProperty()
  object: string; // e.g. list
  @ApiProperty({type: [LlamaCppModelsData]})
  data: LlamaCppModelsData[]
}

export class SpeechToTextRequest {
  @ApiProperty()
  language: string = 'en';
}

export class TextToSpeechRequest {
  @ApiProperty()
  text: string;

  @ApiProperty()
  model: string = 'hexgrad/Kokoro-82M';

  @ApiProperty()
  voice: string = 'af_sky';

  @ApiProperty()
  responseFormat: string = 'mp3';

  @ApiProperty()
  speed: number = 1;
}

export class AudioStreamResponse {
  @ApiProperty()
  text?: string;

  @ApiProperty()
  audio?: string;

  @ApiProperty()
  end?: boolean;

  @ApiProperty()
  error?: string;
}
