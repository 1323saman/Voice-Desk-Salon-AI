
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(
    EmailService.name,
  );

  private readonly resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY is not configured',
      );
    }

    this.resend = new Resend(apiKey);
  }

  async sendBookingConfirmation(
    to: string,
    clientName: string,
    startTime: Date,
  ): Promise<void> {
    try {
      /*
       * TEMPORARY TEST MODE
       *
       * Resend currently only allows your account's
       * own email address as the recipient.
       *
       * Once you verify a domain in Resend, change
       * this back to:
       *
       * to: [to],
       */
      const testRecipient =
        'samansajid8899@gmail.com';

      const { data, error } =
        await this.resend.emails.send({
          from: 'Glow Salon <onboarding@resend.dev>',

          to: [testRecipient],

          subject:
            'Your appointment is confirmed — Glow Salon',

          html: `
            <div>
              <h2>Appointment Confirmed</h2>

              <p>
                Hi ${clientName},
              </p>

              <p>
                Your appointment at
                <strong>Glow Salon</strong>
                is confirmed for
                <strong>
                  ${startTime.toLocaleString()}
                </strong>.
              </p>

              <p>
                We look forward to seeing you!
              </p>

              <hr />

              <p>
                Booking confirmation email sent by
                Glow Salon AI Front Desk.
              </p>
            </div>
          `,
        });

      if (error) {
        this.logger.error(
          `Resend error: ${JSON.stringify(error)}`,
        );
        return;
      }

      this.logger.log(
        `Email sent successfully. Resend ID: ${data?.id}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send booking confirmation email',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }
}

