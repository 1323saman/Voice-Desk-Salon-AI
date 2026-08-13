import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'saman-session-1',
    description:
      'Unique ID used to maintain conversation memory.',
  })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({
    example:
      'My name is Saman Sajid and I want an appointment.',
    description:
      'Message from the customer to the AI receptionist.',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}