import { Module } from '@nestjs/common';

import { VoiceController } from './voice.controller';
import { DeepgramService } from '../deepgram/deepgram.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ChatModule,
  ],

  controllers: [
    VoiceController,
  ],

  providers: [
    DeepgramService,
  ],

  exports: [
    DeepgramService,
  ],
})
export class VoiceModule {}