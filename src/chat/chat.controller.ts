
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './send-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Send a message to the AI receptionist and get a reply',
    description:
      'Allows customers to check availability, book appointments, and cancel bookings using the AI receptionist.',
  })
  @ApiBody({
    type: SendMessageDto,
  })
  @ApiResponse({
    status: 200,
    description:
      'AI receptionist successfully processed the message.',
    schema: {
      example: {
        success: true,
        reply:
          'Your appointment is confirmed. Your booking ID is 01464097-1ba7-42f6-9c37-cb555a6bc0b4.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request. The message is missing or invalid.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal server error while processing the request.',
  })
  async sendMessage(
    @Body() body: SendMessageDto,
  ) {
    try {
      const reply =
        await this.chatService.getReply(
          body.message,
        );

      return {
        success: true,
        reply,
      };
    } catch (error) {
      console.error(
        'CHAT ERROR:',
        error,
      );

      throw error;
    }
  }
}
