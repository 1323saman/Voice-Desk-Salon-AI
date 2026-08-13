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

  /*
   * Send booking confirmation email.
   */
  async sendBookingConfirmation(
    to: string,
    clientName: string,
    startTime: Date,
    bookingId: string,
  ): Promise<void> {
    try {
      const { data, error } =
        await this.resend.emails.send({
          from: 'Glow Salon <onboarding@resend.dev>',

          to: [to],

          subject:
            'Your appointment is confirmed — Glow Salon',

          html: `
            <div
              style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              "
            >

              <h2>
                Appointment Confirmed ✅
              </h2>

              <p>
                Hi ${clientName},
              </p>

              <p>
                Your appointment at
                <strong>Glow Salon</strong>
                has been successfully confirmed.
              </p>

              <div
                style="
                  background: #f5f5f5;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 8px;
                "
              >

                <p>
                  <strong>Booking ID:</strong>
                  ${bookingId}
                </p>

                <p>
                  <strong>Appointment time:</strong>
                  ${startTime.toLocaleString()}
                </p>

              </div>

              <p>
                Please keep your Booking ID safe.
                You will need it if you want to
                cancel or modify your appointment.
              </p>

              <p>
                We look forward to seeing you!
              </p>

              <hr />

              <p style="color: #666;">
                This confirmation was sent by
                Glow Salon AI Front Desk.
              </p>

            </div>
          `,
        });

      if (error) {
        this.logger.error(
          `Resend booking confirmation error: ${JSON.stringify(
            error,
          )}`,
        );

        return;
      }

      this.logger.log(
        `Booking confirmation sent to ${to}. Resend ID: ${data?.id}`,
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

  /*
   * Send cancellation email.
   */
  async sendCancellationEmail(
    to: string,
    clientName: string,
    startTime: Date,
    bookingId: string,
  ): Promise<void> {
    try {
      const { data, error } =
        await this.resend.emails.send({
          from: 'Glow Salon <onboarding@resend.dev>',

          to: [to],

          subject:
            'Your appointment has been cancelled — Glow Salon',

          html: `
            <div
              style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              "
            >

              <h2>
                Appointment Cancelled
              </h2>

              <p>
                Hi ${clientName},
              </p>

              <p>
                Your appointment at
                <strong>Glow Salon</strong>
                has been successfully cancelled.
              </p>

              <div
                style="
                  background: #f5f5f5;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 8px;
                "
              >

                <p>
                  <strong>Booking ID:</strong>
                  ${bookingId}
                </p>

                <p>
                  <strong>
                    Cancelled appointment time:
                  </strong>
                  ${startTime.toLocaleString()}
                </p>

              </div>

              <p>
                If you would like to book another
                appointment, you can use the
                Glow Salon AI Front Desk.
              </p>

              <hr />

              <p style="color: #666;">
                This cancellation notice was sent by
                Glow Salon AI Front Desk.
              </p>

            </div>
          `,
        });

      if (error) {
        this.logger.error(
          `Resend cancellation error: ${JSON.stringify(
            error,
          )}`,
        );

        return;
      }

      this.logger.log(
        `Cancellation email sent to ${to}. Resend ID: ${data?.id}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send cancellation email',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }
}