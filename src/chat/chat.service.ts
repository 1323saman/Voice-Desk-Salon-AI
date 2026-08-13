import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  private readonly groq: Groq;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly ragService: RagService,
  ) {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async getReply(
    sessionId: string,
    message: string,
  ): Promise<string> {
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured.');
      return 'The AI service is not configured correctly.';
    }

    if (!sessionId?.trim()) {
      return 'A session ID is required.';
    }

    if (!message?.trim()) {
      return 'Please enter a message.';
    }

    const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'checkAvailability',
          description:
            'Get currently available future appointment slots.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },

      {
        type: 'function',
        function: {
          name: 'bookSlot',
          description:
            'Book an available appointment slot for a client.',
          parameters: {
            type: 'object',
            properties: {
              slotId: {
                type: 'string',
                description:
                  'The exact ID of the available slot.',
              },
              clientName: {
                type: 'string',
                description:
                  'Full name of the client.',
              },
              clientEmail: {
                type: 'string',
                description:
                  'Email address of the client.',
              },
            },
            required: [
              'slotId',
              'clientName',
              'clientEmail',
            ],
          },
        },
      },

      {
        type: 'function',
        function: {
          name: 'cancelSlot',
          description:
            'Cancel an existing booking using the booking ID.',
          parameters: {
            type: 'object',
            properties: {
              bookingId: {
                type: 'string',
                description:
                  'The ID of the booking to cancel.',
              },
            },
            required: ['bookingId'],
          },
        },
      },
    ];

    let session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
    });

    let business = await this.prisma.business.findFirst();

    if (!business) {
      return 'No business is configured yet.';
    }

    if (!session) {
      session = await this.prisma.session.create({
        data: {
          id: sessionId,
          businessId: business.id,
        },
      });
    } else {
      business = await this.prisma.business.findUnique({
        where: {
          id: session.businessId,
        },
      });

      if (!business) {
        return 'The business associated with this session could not be found.';
      }
    }

    await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message.trim(),
      },
    });

    const history = await this.prisma.message.findMany({
      where: {
        sessionId: session.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    let knowledgeContext = '';

    try {
      knowledgeContext = await this.ragService.search(
        session.businessId,
        message.trim(),
        5,
      );
    } catch (error) {
      console.error('RAG search failed:', error);
      knowledgeContext = '';
    }

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: 'system',
          content: `
You are a friendly receptionist for a salon called Glow Salon.

Your job is to help customers with:

- Questions about the salon
- Salon services
- Salon policies
- Pricing
- Opening hours
- Location
- Appointment availability
- Booking appointments
- Cancelling appointments

IMPORTANT KNOWLEDGE BASE RULE:

You have access to a business knowledge base below.

Use the knowledge base when answering questions about
Glow Salon.

KNOWLEDGE BASE:
${knowledgeContext || 'No relevant knowledge was found.'}
END KNOWLEDGE BASE.

Rules:

1. Use relevant information from the knowledge base.

2. Do not invent salon services, prices, policies,
   opening hours, location information, or other
   business information.

3. If the knowledge base does not contain the answer,
   clearly tell the customer that you do not have
   that information.

4. Keep answers polite, helpful, and concise.

IMPORTANT MEMORY RULE:

This is a multi-turn conversation.

Use previous conversation messages to remember
information already provided by the customer.

Do not ask for information that the customer
already provided in the same session.

BOOKING RULES:

1. If the customer asks about availability:
   - Use checkAvailability.
   - Show available future appointment times.

2. If the customer wants to book:
   - Check conversation history for name and email.
   - Ask for missing information.
   - Use checkAvailability if necessary.
   - Find the requested slot.
   - Use bookSlot with the exact slot ID.

3. Do not ask for confirmation when the customer
   has clearly requested the booking.

4. If requested time is unavailable:
   - Do not automatically book another time.
   - Show available alternatives.

5. Never invent a slot ID.

6. Never invent a booking ID.

7. After successful booking:
   - Tell the customer the booking is confirmed.
   - Provide the real booking ID returned by bookSlot.

8. Never claim a booking succeeded unless
   bookSlot returns success: true.

CANCELLATION RULES:

9. If the customer wants to cancel:
   - Ask for the booking ID if it was not provided.
   - Use cancelSlot with the real booking ID.

10. Never invent a booking ID.

11. If cancelSlot returns success: false,
    do not claim cancellation succeeded.

EMAIL RULE:

If an email contains Markdown such as:

[sam@example.com](mailto:sam@example.com)

extract only:

sam@example.com

before passing it to bookSlot.
`,
        },
      ];

    for (const item of history) {
      if (
        item.role === 'user' ||
        item.role === 'assistant'
      ) {
        messages.push({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        });
      }
    }

    for (
      let attempt = 0;
      attempt < 5;
      attempt++
    ) {
      try {
        const response =
          await this.groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages,
            tools,
            tool_choice: 'auto',
          });

        const choice = response.choices[0];

        if (!choice) {
          return 'Sorry, I could not generate a reply.';
        }

        const toolCalls = choice.message.tool_calls;

        if (
          !toolCalls ||
          toolCalls.length === 0
        ) {
          const finalReply =
            choice.message.content ??
            'Sorry, I could not generate a reply.';

          await this.prisma.message.create({
            data: {
              sessionId: session.id,
              role: 'assistant',
              content: finalReply,
            },
          });

          return finalReply;
        }

        messages.push(choice.message);

        for (const toolCall of toolCalls) {
          let toolResult: string;

          try {
            if (
              toolCall.function.name ===
              'checkAvailability'
            ) {
              toolResult =
                await this.checkAvailability(
                  session.businessId,
                );
            } else if (
              toolCall.function.name ===
              'bookSlot'
            ) {
              toolResult =
                await this.bookSlot(
                  toolCall.function.arguments,
                  session.businessId,
                );
            } else if (
              toolCall.function.name ===
              'cancelSlot'
            ) {
              toolResult =
                await this.cancelSlot(
                  toolCall.function.arguments,
                  session.businessId,
                );
            } else {
              toolResult = JSON.stringify({
                success: false,
                message:
                  'Unknown tool requested.',
              });
            }
          } catch (error) {
            console.error(
              `Tool ${toolCall.function.name} failed:`,
              error,
            );

            toolResult = JSON.stringify({
              success: false,
              message:
                'The requested operation failed. Please try again.',
            });
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } catch (error) {
        console.error(
          'Groq request failed:',
          error,
        );

        return 'Sorry, I could not process your request right now. Please try again.';
      }
    }

    return 'Sorry, I could not complete your request. Please try again.';
  }

  private async checkAvailability(
    businessId: string,
  ): Promise<string> {
    try {
      const now = new Date();

      const slots =
        await this.prisma.slot.findMany({
          where: {
            businessId,
            isBooked: false,
            startTime: {
              gt: now,
            },
          },
          orderBy: {
            startTime: 'asc',
          },
          take: 10,
        });

      if (slots.length === 0) {
        return JSON.stringify({
          success: false,
          message:
            'No future available slots at the moment.',
          slots: [],
        });
      }

      return JSON.stringify({
        success: true,
        slots: slots.map((slot) => ({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      });
    } catch (error) {
      console.error(
        'Availability error:',
        error,
      );

      return JSON.stringify({
        success: false,
        message:
          'Could not check availability.',
        slots: [],
      });
    }
  }

  private async bookSlot(
    argumentsString: string,
    businessId: string,
  ): Promise<string> {
    try {
      const args = JSON.parse(
        argumentsString,
      ) as {
        slotId?: string;
        clientName?: string;
        clientEmail?: string;
      };

      const slotId =
        args.slotId?.trim();

      const clientName =
        args.clientName?.trim();

      const clientEmail =
        this.cleanEmail(args.clientEmail);

      if (
        !slotId ||
        !clientName ||
        !clientEmail
      ) {
        return JSON.stringify({
          success: false,
          message:
            'Slot ID, client name, and client email are required.',
        });
      }

      const slot =
        await this.prisma.slot.findUnique({
          where: {
            id: slotId,
          },
        });

      if (!slot) {
        return JSON.stringify({
          success: false,
          message: 'Slot not found.',
        });
      }

      if (
        slot.businessId !== businessId
      ) {
        return JSON.stringify({
          success: false,
          message:
            'This appointment slot is not available for this business.',
        });
      }

      if (slot.isBooked) {
        return JSON.stringify({
          success: false,
          message:
            'Sorry, that slot is already booked.',
        });
      }

      if (slot.startTime <= new Date()) {
        return JSON.stringify({
          success: false,
          message:
            'Sorry, that appointment slot is in the past.',
        });
      }

      const existingBooking =
        await this.prisma.booking.findUnique({
          where: {
            slotId: slot.id,
          },
        });

      let client =
        await this.prisma.client.findFirst({
          where: {
            email: clientEmail,
            businessId,
          },
        });

      if (!client) {
        client =
          await this.prisma.client.create({
            data: {
              name: clientName,
              email: clientEmail,
              businessId,
            },
          });
      } else {
        client =
          await this.prisma.client.update({
            where: {
              id: client.id,
            },
            data: {
              name: clientName,
              email: clientEmail,
            },
          });
      }

      let booking;

      if (existingBooking) {
        if (
          existingBooking.status !==
          'cancelled'
        ) {
          return JSON.stringify({
            success: false,
            message:
              'This slot already has an active booking.',
          });
        }

        booking =
          await this.prisma.booking.update({
            where: {
              id: existingBooking.id,
            },
            data: {
              clientId: client.id,
              status: 'confirmed',
            },
          });
      } else {
        booking =
          await this.prisma.booking.create({
            data: {
              slotId: slot.id,
              clientId: client.id,
              status: 'confirmed',
            },
          });
      }

      await this.prisma.slot.update({
        where: {
          id: slot.id,
        },
        data: {
          isBooked: true,
        },
      });

      /*
       * Send booking confirmation email.
       */
      await this.emailService.sendBookingConfirmation(
        clientEmail,
        clientName,
        slot.startTime,
        booking.id,
      );

      return JSON.stringify({
        success: true,
        bookingId: booking.id,
        slotId: slot.id,
        clientName,
        clientEmail,
        startTime: slot.startTime,
        message:
          `Booking confirmed for ${clientName}.`,
      });
    } catch (error) {
      console.error(
        'Booking error:',
        error,
      );

      return JSON.stringify({
        success: false,
        message:
          'Booking failed. Please try again.',
      });
    }
  }

  private async cancelSlot(
    argumentsString: string,
    businessId: string,
  ): Promise<string> {
    try {
      const args = JSON.parse(
        argumentsString,
      ) as {
        bookingId?: string;
      };

      const bookingId =
        args.bookingId?.trim();

      if (!bookingId) {
        return JSON.stringify({
          success: false,
          message:
            'Booking ID is required.',
        });
      }

      const booking =
        await this.prisma.booking.findUnique({
          where: {
            id: bookingId,
          },
          include: {
            client: true,
            slot: true,
          },
        });

      if (!booking) {
        return JSON.stringify({
          success: false,
          message:
            'Booking not found.',
        });
      }

      if (
        booking.slot.businessId !==
        businessId
      ) {
        return JSON.stringify({
          success: false,
          message:
            'This booking does not belong to this business.',
        });
      }

      if (
        booking.status === 'cancelled'
      ) {
        return JSON.stringify({
          success: false,
          message:
            'This booking has already been cancelled.',
        });
      }

      await this.prisma.slot.update({
        where: {
          id: booking.slotId,
        },
        data: {
          isBooked: false,
        },
      });

      await this.prisma.booking.update({
        where: {
          id: bookingId,
        },
        data: {
          status: 'cancelled',
        },
      });

      /*
       * Send cancellation email only if
       * the client has an email address.
       */
      if (booking.client.email) {
        await this.emailService.sendCancellationEmail(
          booking.client.email,
          booking.client.name,
          booking.slot.startTime,
          booking.id,
        );
      } else {
        console.warn(
          `No email address found for cancelled booking ${booking.id}`,
        );
      }

      return JSON.stringify({
        success: true,
        bookingId,
        message:
          'Booking cancelled successfully.',
      });
    } catch (error) {
      console.error(
        'Cancellation error:',
        error,
      );

      return JSON.stringify({
        success: false,
        message:
          'Cancellation failed. Please try again.',
      });
    }
  }

  private cleanEmail(
    email?: string,
  ): string {
    if (!email) {
      return '';
    }

    let cleaned =
      email.trim();

    const markdownMatch =
      cleaned.match(
        /^\[([^\]]+)\]\(mailto:([^)]+)\)$/i,
      );

    if (markdownMatch) {
      cleaned =
        markdownMatch[2];
    }

    cleaned =
      cleaned.replace(
        /^mailto:/i,
        '',
      );

    cleaned =
      cleaned
        .replace(
          /[<>\[\]]/g,
          '',
        )
        .trim();

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleaned)) {
      return '';
    }

    return cleaned;
  }
}