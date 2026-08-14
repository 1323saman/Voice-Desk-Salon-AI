import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ChatService } from '../chat/chat.service';
import { DeepgramService } from '../deepgram/deepgram.service';

@ApiTags('voice')
@Controller('chat/voice')
export class VoiceController {
  constructor(
    private readonly chatService: ChatService,
    private readonly deepgramService: DeepgramService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Send a voice message to the AI receptionist and get a text reply',
    description:
      'Accepts an audio file, transcribes it using Deepgram, then routes the transcribed text through the same chat logic used for text messages.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID used to track conversation history.',
        },
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file containing the customer message.',
        },
      },
      required: ['sessionId', 'audio'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'AI receptionist successfully transcribed and processed the voice message.',
    schema: {
      example: {
        success: true,
        transcript: 'Do you have any slots open this week?',
        reply: 'Here are the available times this week...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request. The audio file or session ID is missing.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal server error while processing the voice message.',
  })
  async sendVoiceMessage(
    @Body('sessionId') sessionId: string,
    @UploadedFile() audio: Express.Multer.File,
  ) {
    try {
      if (!sessionId?.trim()) {
        return {
          success: false,
          message: 'A session ID is required.',
        };
      }

      if (!audio) {
        return {
          success: false,
          message: 'An audio file is required.',
        };
      }

      const transcript = await this.deepgramService.transcribeAudio(
        audio.buffer,
      );

      if (!transcript?.trim()) {
        return {
          success: false,
          message: 'Could not transcribe the audio. Please try again.',
        };
      }

      const reply = await this.chatService.getReply(
        sessionId,
        transcript,
      );

      let replyAudioBase64: string | null = null;

      try {
        const replyAudioBuffer = await this.deepgramService.textToSpeech(
          reply,
        );
        replyAudioBase64 = replyAudioBuffer.toString('base64');
      } catch (ttsError) {
        console.error('Text-to-speech failed:', ttsError);
        // Voice reply generation is best-effort; text reply still returns.
      }

      return {
        success: true,
        transcript,
        reply,
        replyAudioBase64,
      };
    } catch (error) {
      console.error('VOICE ERROR:', error);
      throw error;
    }
  }
}