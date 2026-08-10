import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  private groq: Groq;

  constructor(private readonly prisma: PrismaService) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async getReply(message: string): Promise<string> {
    const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'checkAvailability',
          description: 'Get the list of currently open, unbooked appointment slots',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'bookSlot',
          description: 'Book a specific appointment slot by its ID for a customer',
          parameters: {
            type: 'object',
            properties: {
              slotId: { type: 'string', description: 'The ID of the slot to book' },
              customerName: { type: 'string', description: "The customer's name" },
              customerEmail: { type: 'string', description: "The customer's email" },
            },
            required: ['slotId', 'customerName', 'customerEmail'],
          },
        },
      },
    ];

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a friendly receptionist for a salon called Glow Salon. Use checkAvailability to show open times. When a customer picks a time, ask for their name and email if you do not have them yet, then use bookSlot to confirm the booking.',
      },
      { role: 'user', content: message },
    ];

    let response = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools,
    });

    // Loop in case the AI needs multiple tool calls
    while (response.choices[0].message.tool_calls?.length) {
      const toolCall = response.choices[0].message.tool_calls[0];
      let toolResult = '';

      if (toolCall.function.name === 'checkAvailability') {
        const slots = await this.prisma.slot.findMany({
          where: { isBooked: false },
          orderBy: { startTime: 'asc' },
          take: 5,
        });
        toolResult = JSON.stringify(
          slots.map((s) => ({ id: s.id, startTime: s.startTime })),
        );
      }

      if (toolCall.function.name === 'bookSlot') {
        const args = JSON.parse(toolCall.function.arguments);

        const slot = await this.prisma.slot.findUnique({ where: { id: args.slotId } });
        if (!slot || slot.isBooked) {
          toolResult = JSON.stringify({ success: false, reason: 'Slot not available' });
        } else {
          let client = await this.prisma.client.findFirst({
            where: { email: args.customerEmail },
          });
          if (!client) {
            client = await this.prisma.client.create({
              data: {
                businessId: slot.businessId,
                name: args.customerName,
                email: args.customerEmail,
              },
            });
          }

          await this.prisma.$transaction([
            this.prisma.slot.update({
              where: { id: slot.id },
              data: { isBooked: true },
            }),
            this.prisma.booking.create({
              data: { slotId: slot.id, clientId: client.id },
            }),
          ]);

          toolResult = JSON.stringify({ success: true, startTime: slot.startTime });
        }
      }

      messages.push(response.choices[0].message);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      });

      response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools,
      });
    }

    return response.choices[0].message.content ?? 'Sorry, I could not generate a reply.';
  }
}