import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from '../email/email.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [
    PrismaModule,
    RagModule,
  ],

  controllers: [
    ChatController,
  ],

  providers: [
    ChatService,
    EmailService,
  ],

  exports: [
    ChatService,
  ],
})
export class ChatModule {}