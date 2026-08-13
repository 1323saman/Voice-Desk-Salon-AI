import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ChatModule } from './chat/chat.module';
import { PrismaModule } from './prisma/prisma.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    /*
     * Environment variables
     */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    /*
     * Serve frontend files from:
     *
     * /public
     *
     * This will allow us to create a
     * browser microphone recorder.
     */
    ServeStaticModule.forRoot({
      rootPath: join(
        process.cwd(),
        'public',
      ),
    }),

    /*
     * Database
     */
    PrismaModule,

    /*
     * Chat / AI / booking / RAG
     */
    ChatModule,

    /*
     * Voice:
     *
     * microphone audio
     *      ↓
     * Deepgram STT
     *      ↓
     * ChatService
     *      ↓
     * Deepgram TTS
     *      ↓
     * audio response
     */
    VoiceModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}