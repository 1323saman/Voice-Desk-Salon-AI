
import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ChatService {
  private readonly groq: Groq;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async getReply(message: string): Promise<string> {
    const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'checkAvailability',
          description:
            'Get currently available appointment slots. Use this when the customer asks about available appointment times or when you need to find a slot for a requested appointment time.',
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
            'Book an available appointment slot for a client. Use this after finding the correct slot and having the client name and email.',
          parameters: {
            type: 'object',
            properties: {
              slotId: {
                type: 'string',
                description:
                  'The exact ID of the available slot to book',
              },
              clientName: {
                type: 'string',
                description: 'Full name of the client',
              },
              clientEmail: {
                type: 'string',
                description: 'Email address of the client',
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
                  'The ID of the booking to cancel',
              },
            },
            required: ['bookingId'],
          },
        },
      },
    ];

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `
You are a friendly receptionist for a salon called Glow Salon.

Your job is to help customers check availability, book appointments, and cancel bookings.

BOOKING RULES:

1. If the customer only asks about available times:
   - Use checkAvailability.
   - Show the available appointment times clearly.

2. If the customer wants to BOOK a specific time and has already provided their name and email:
   - Use checkAvailability first if you do not know the slot ID.
   - After receiving the available slots, find the slot that best matches the customer's requested time.
   - Use bookSlot with the exact slot ID, customer name, and customer email.
   - Do NOT ask the customer for confirmation again when they have already clearly said they want to book.

3. If the customer wants to book but has not provided their name:
   - Ask for their name.

4. If the customer wants to book but has not provided their email:
   - Ask for their email.

5. If the requested appointment time is not available:
   - Do not attempt to book another time without telling the customer.
   - Tell the customer that the requested time is unavailable.
   - Show the available alternatives.

6. Never invent a slot ID.

7. Never invent a booking ID.

8. After a successful booking:
   - Clearly tell the customer that the appointment is confirmed.
   - Provide the real booking ID returned by bookSlot.

9. Never claim that an appointment was booked unless bookSlot returns success: true.

10. If the customer wants to cancel a booking:
    - Use cancelSlot with the provided booking ID.

11. If a tool returns success: false:
    - Do not claim that the operation succeeded.
    - Explain the failure clearly to the customer.

12. Always be polite and concise.

EMAIL RULE:

If an email contains Markdown formatting such as:

[name@example.com](mailto:name@example.com)

extract only the actual email address before passing it to bookSlot.
`,
      },
      {
        role: 'user',
        content: message,
      },
    ];

    /*
     * Allow multiple tool calls in the same request.
     *
     * Example:
     *
     * checkAvailability
     *        ↓
     * find requested slot
     *        ↓
     * bookSlot
     *        ↓
     * final AI response
     */
    for (let attempt = 0; attempt < 5; attempt++) {
      const response =
        await this.groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages,
          tools,
          tool_choice: 'auto',
        });

      const choice = response.choices[0];

      if (!choice) {
        return 'Sorry, I could not generate a reply.';
      }

      const toolCalls = choice.message.tool_calls;

      /*
       * No more tools are required.
       * Return the AI's final response.
       */
      if (!toolCalls || toolCalls.length === 0) {
        return (
          choice.message.content ??
          'Sorry, I could not generate a reply.'
        );
      }

      /*
       * Add the assistant's tool-call message
       * to the conversation.
       */
      messages.push(choice.message);

      /*
       * Process every requested tool call.
       */
      for (const toolCall of toolCalls) {
        let toolResult: string;

        try {
          if (
            toolCall.function.name ===
            'checkAvailability'
          ) {
            toolResult =
              await this.checkAvailability();
          } else if (
            toolCall.function.name === 'bookSlot'
          ) {
            toolResult = await this.bookSlot(
              toolCall.function.arguments,
            );
          } else if (
            toolCall.function.name === 'cancelSlot'
          ) {
            toolResult = await this.cancelSlot(
              toolCall.function.arguments,
            );
          } else {
            toolResult = JSON.stringify({
              success: false,
              message: 'Unknown tool requested.',
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
    }

    return 'Sorry, I could not complete your request. Please try again.';
  }

  /**
   * Get available appointment slots.
   */
  private async checkAvailability(): Promise<string> {
    try {
      const slots = await this.prisma.slot.findMany({
        where: {
          isBooked: false,
        },
        orderBy: {
          startTime: 'asc',
        },
        take: 10,
      });

      if (slots.length === 0) {
        return JSON.stringify({
          success: false,
          message: 'No available slots at the moment.',
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
        message: 'Could not check availability.',
        slots: [],
      });
    }
  }

  /**
   * Book an appointment slot.
   *
   * Important:
   * Booking.slotId is @unique in Prisma.
   *
   * Therefore, if a previous booking for this slot
   * was cancelled, we reuse that cancelled booking
   * instead of creating a second Booking record.
   */
  private async bookSlot(
    argumentsString: string,
  ): Promise<string> {
    try {
      const args = JSON.parse(
        argumentsString,
      ) as {
        slotId?: string;
        clientName?: string;
        clientEmail?: string;
      };

      const slotId = args.slotId?.trim();
      const clientName = args.clientName?.trim();
      const clientEmail = this.cleanEmail(
        args.clientEmail,
      );

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

      /*
       * Find the requested slot.
       */
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

      /*
       * If the slot is currently booked,
       * reject the booking.
       */
      if (slot.isBooked) {
        return JSON.stringify({
          success: false,
          message:
            'Sorry, that slot is already booked.',
        });
      }

      /*
       * Check whether a Booking record already exists
       * for this slot.
       *
       * This can happen when a previous booking was
       * cancelled.
       */
      const existingBooking =
        await this.prisma.booking.findUnique({
          where: {
            slotId: slot.id,
          },
        });

      /*
       * Find an existing client for this business.
       */
      let client =
        await this.prisma.client.findFirst({
          where: {
            email: clientEmail,
            businessId: slot.businessId,
          },
        });

      /*
       * Create the client if they don't exist.
       */
      if (!client) {
        client =
          await this.prisma.client.create({
            data: {
              name: clientName,
              email: clientEmail,
              businessId: slot.businessId,
            },
          });
      } else {
        /*
         * Update the client's information if
         * the customer already exists.
         */
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

      /*
       * If a previous booking exists for this slot,
       * it must be cancelled before it can be reused.
       */
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

        /*
         * Reuse the cancelled booking.
         */
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
        /*
         * No previous booking exists,
         * so create a new booking.
         */
        booking =
          await this.prisma.booking.create({
            data: {
              slotId: slot.id,
              clientId: client.id,
              status: 'confirmed',
            },
          });
      }

      /*
       * Mark the slot as booked.
       */
      await this.prisma.slot.update({
        where: {
          id: slot.id,
        },
        data: {
          isBooked: true,
        },
      });

      /*
       * Send confirmation email.
       *
       * EmailService handles its own errors,
       * so a failed email does not undo the booking.
       */
      await this.emailService.sendBookingConfirmation(
        clientEmail,
        clientName,
        slot.startTime,
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

  /**
   * Cancel an existing booking.
   */
  private async cancelSlot(
    argumentsString: string,
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

      /*
       * Find the booking.
       */
      const booking =
        await this.prisma.booking.findUnique({
          where: {
            id: bookingId,
          },
        });

      if (!booking) {
        return JSON.stringify({
          success: false,
          message: 'Booking not found.',
        });
      }

      /*
       * Prevent cancelling the same booking twice.
       */
      if (
        booking.status === 'cancelled'
      ) {
        return JSON.stringify({
          success: false,
          message:
            'This booking has already been cancelled.',
        });
      }

      /*
       * Free the slot.
       */
      await this.prisma.slot.update({
        where: {
          id: booking.slotId,
        },
        data: {
          isBooked: false,
        },
      });

      /*
       * Keep the booking record but mark it cancelled.
       *
       * This allows bookSlot() to reuse it later
       * because slotId is unique.
       */
      await this.prisma.booking.update({
        where: {
          id: bookingId,
        },
        data: {
          status: 'cancelled',
        },
      });

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

  /**
   * Clean email addresses returned by the AI.
   *
   * Handles:
   *
   * [john@example.com](mailto:john@example.com)
   *
   * mailto:john@example.com
   *
   * john@example.com
   */
  private cleanEmail(
    email?: string,
  ): string {
    if (!email) {
      return '';
    }

    let cleaned = email.trim();

    /*
     * Convert Markdown email:
     *
     * [john@example.com](mailto:john@example.com)
     *
     * into:
     *
     * john@example.com
     */
    const markdownMatch =
      cleaned.match(
        /^\[([^\]]+)\]\(mailto:([^)]+)\)$/i,
      );

    if (markdownMatch) {
      cleaned = markdownMatch[2];
    }

    /*
     * Remove mailto: if present.
     */
    cleaned = cleaned.replace(
      /^mailto:/i,
      '',
    );

    /*
     * Remove accidental surrounding
     * characters.
     */
    cleaned = cleaned
      .replace(/[<>\[\]]/g, '')
      .trim();

    return cleaned;
  }
}

