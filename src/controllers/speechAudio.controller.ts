import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Sse,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody, ApiConsumes, ApiProperty } from '@nestjs/swagger';
import { SpeechAudioService } from '../services/speechAudio.service';
import { SpeechToTextRequest, TextToSpeechRequest } from '../models/api/conversationApiModels';
import { Observable } from 'rxjs';
import { Multer } from 'multer';

@ApiTags('Speech Audio')
@Controller('speech-audio')
export class SpeechAudioController {
  constructor(private readonly speechAudioService: SpeechAudioService) {}

  @ApiOperation({ summary: 'Stream audio transcription from microphone' })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: { "text": "transcription", "end": "true" }',
        },
      },
    },
  })
  @Get('transcribeStreaming')
  @Sse()
  streamTranscription(): Observable<any> {
    return this.speechAudioService.streamTranscription();
  }

  @ApiOperation({ summary: 'Upload audio file for transcription (non-streaming)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Audio file and language parameter',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary', // This explicitly defines it as a file upload
        },
        language: {
          type: 'string',
          description: 'Language code (e.g., en-US)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response with transcription text',
    type: String,
  })
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  async transcribeAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SpeechToTextRequest,
  ): Promise<string> {
    return this.speechAudioService.transcribeAudioSync(file, body.language);
  }

  @ApiOperation({ summary: 'Upload audio file for transcription with streaming response' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Audio file to transcribe',
    type: SpeechToTextRequest,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: { "text": "transcription", "end": "true" }',
        },
      },
    },
  })
  @Post('transcribeStreaming')
  @UseInterceptors(FileInterceptor('file'))
  @Sse()
  transcribeAudioStreaming(
    @UploadedFile() file: any,
    @Body() body: SpeechToTextRequest,
  ): Observable<any> {
    return this.speechAudioService.transcribeAudio(file, body.language);
  }

  @ApiOperation({ summary: 'Convert text to speech (non-streaming)' })
  @ApiBody({
    description: 'Text to convert to speech',
    type: TextToSpeechRequest,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response with audio buffer',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Post('textToSpeech')
  async textToSpeech(
    @Body() body: TextToSpeechRequest,
    @Res({ passthrough: true }) res,
  ): Promise<StreamableFile> {
    const audioBuffer = await this.speechAudioService.textToSpeechSync(
      body.text,
      body.model,
      body.voice,
      body.responseFormat,
      body.speed,
    );
    // Set headers for binary response
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    return new StreamableFile(audioBuffer);
  }

  @ApiOperation({ summary: 'Convert text to speech and stream audio back' })
  @ApiQuery({ name: 'text', required: true, description: 'Text to convert to speech' })
  @ApiQuery({ name: 'model', required: false, description: 'Model to use', example: 'hexgrad/Kokoro-82M' })
  @ApiQuery({ name: 'voice', required: false, description: 'Voice to use', example: 'af_sky' })
  @ApiQuery({ name: 'responseFormat', required: false, description: 'Response format', example: 'mp3' })
  @ApiQuery({ name: 'speed', required: false, description: 'Speech speed', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: { "audio": "base64EncodedAudio", "end": "true" }',
        },
      },
    },
  })
  @Get('textToSpeechStreaming')
  @Sse()
  async textToSpeechStreaming(
    @Query('text') text: string,
    @Query('model') model = 'hexgrad/Kokoro-82M',
    @Query('voice') voice = 'af_sky',
    @Query('responseFormat') responseFormat = 'mp3',
    @Query('speed') speed = 1,
  ): Promise<Observable<any>> {
    return await this.speechAudioService.textToSpeechStreaming(text, model, voice, responseFormat, Number(speed));
  }

  @ApiOperation({ summary: 'Cancel ongoing audio processing' })
  @ApiQuery({
    name: 'sessionId',
    type: String,
    description: 'The ID of the session to cancel',
  })
  @Get('cancel')
  cancelAudioProcessing(@Query('sessionId') sessionId: string): { success: boolean, message: string } {
    return this.speechAudioService.cancelAudioProcessing(sessionId);
  }
}
