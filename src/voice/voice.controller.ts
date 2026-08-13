import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';

import type { Express } from 'express';

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
  @ApiOperation({
    summary:
      'Send voice message and receive AI voice response',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          example: 'voice-test-001',
        },

        audio: {
          type: 'string',
          format: 'binary',
        },
      },

      required: [
        'sessionId',
        'audio',
      ],
    },
  })
  @UseInterceptors(
    FileInterceptor('audio'),
  )
  async handleVoice(
    @UploadedFile()
    audio: Express.Multer.File,

    @Body('sessionId')
    sessionId: string,
  ) {
    if (!sessionId?.trim()) {
      return {
        success: false,
        transcript: '',
        reply: 'Session ID is required.',
        audioBase64: null,
      };
    }

    if (!audio) {
      return {
        success: false,
        transcript: '',
        reply:
          'Please provide an audio file.',
        audioBase64: null,
      };
    }

    try {
      console.log(
        '====================================',
      );

      console.log(
        'VOICE REQUEST RECEIVED',
      );

      console.log(
        `Session: ${sessionId}`,
      );

      console.log(
        `File: ${audio.originalname}`,
      );

      console.log(
        `MIME: ${audio.mimetype}`,
      );

      console.log(
        `Size: ${audio.size} bytes`,
      );

      console.log(
        '====================================',
      );

      /*
       * Speech → Text
       */
      const transcript =
        await this.deepgramService.transcribeAudio(
          audio.buffer,
        );

      if (!transcript.trim()) {
        return {
          success: false,
          transcript: '',
          reply:
            "Sorry, I couldn't hear that clearly. Please try again.",
          audioBase64: null,
        };
      }

      console.log(
        `Transcript: ${transcript}`,
      );

      /*
       * Send transcript to existing
       * AI/chat system.
       */
      const reply =
        await this.chatService.getReply(
          sessionId,
          transcript,
        );

      console.log(
        `AI Reply: ${reply}`,
      );

      /*
       * AI text → Speech
       */
      const audioBuffer =
        await this.deepgramService.textToSpeech(
          reply,
        );

      console.log(
        `TTS Audio: ${audioBuffer.length} bytes`,
      );

      /*
       * Convert MP3 to Base64.
       */
      const audioBase64 =
        audioBuffer.toString(
          'base64',
        );

      return {
        success: true,

        transcript,

        reply,

        audioBase64,
      };
    } catch (error) {
      console.error(
        'Voice request failed:',
        error,
      );

      return {
        success: false,
        transcript: '',
        reply:
          'Sorry, I could not process your voice message.',
        audioBase64: null,
      };
    }
  }
}