
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example:
      'I want to book an appointment at 4:09 PM. My name is Saman Sajid and my email is samansajid0158@gmail.com.',
    description:
      'Message from the customer to the AI receptionist.',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
