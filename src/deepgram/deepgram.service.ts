import { Injectable, Logger } from '@nestjs/common';
import { DeepgramClient } from '@deepgram/sdk';

@Injectable()
export class DeepgramService {
  private readonly logger =
    new Logger(DeepgramService.name);

  private readonly deepgram: DeepgramClient;

  constructor() {
    const apiKey =
      process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      throw new Error(
        'DEEPGRAM_API_KEY is not configured',
      );
    }

    this.deepgram =
      new DeepgramClient({
        apiKey,
      });

    this.logger.log(
      'Deepgram service initialized successfully.',
    );
  }

  /**
   * Convert speech/audio into text.
   */
  async transcribeAudio(
    buffer: Buffer,
  ): Promise<string> {
    try {
      if (!buffer || buffer.length === 0) {
        throw new Error(
          'Audio buffer is empty.',
        );
      }

      this.logger.log(
        `Starting speech-to-text. Audio size: ${buffer.length} bytes`,
      );

      const response: any =
        await this.deepgram.listen.v1.media.transcribeFile(
          buffer,
          {
            model: 'nova-3',
            smart_format: true,
          },
        );

      const transcript =
        response?.results
          ?.channels?.[0]
          ?.alternatives?.[0]
          ?.transcript ?? '';

      const cleanedTranscript =
        String(transcript).trim();

      this.logger.log(
        `Speech-to-text completed. Transcript: "${cleanedTranscript}"`,
      );

      if (!cleanedTranscript) {
        this.logger.warn(
          'Deepgram returned an empty transcript.',
        );

        return '';
      }

      return cleanedTranscript;
    } catch (error) {
      this.logger.error(
        'Deepgram transcription failed.',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new Error(
        'Failed to transcribe audio.',
      );
    }
  }

  /**
   * Convert AI text response into MP3 audio.
   */
  async textToSpeech(
    text: string,
  ): Promise<Buffer> {
    try {
      const cleanedText =
        text?.trim();

      if (!cleanedText) {
        throw new Error(
          'Text for speech generation is empty.',
        );
      }

      this.logger.log(
        `Starting text-to-speech. Text length: ${cleanedText.length}`,
      );

      const response =
        await this.deepgram.speak.v1.audio.generate(
          {
            text: cleanedText,

            /*
             * Deepgram Aura voice.
             */
            model:
              'aura-2-thalia-en',

            /*
             * MP3 is convenient for
             * browser playback.
             */
            encoding: 'mp3',
          },
        );

      const stream =
        response?.stream();

      if (!stream) {
        throw new Error(
          'Deepgram did not return an audio stream.',
        );
      }

      const reader =
        stream.getReader();

      const chunks: Uint8Array[] = [];

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          chunks.push(value);
        }
      }

      if (chunks.length === 0) {
        throw new Error(
          'Deepgram returned an empty audio stream.',
        );
      }

      const audioBuffer =
        Buffer.concat(
          chunks.map((chunk) =>
            Buffer.from(chunk),
          ),
        );

      if (audioBuffer.length === 0) {
        throw new Error(
          'Generated audio buffer is empty.',
        );
      }

      this.logger.log(
        `Text-to-speech completed. Generated audio size: ${audioBuffer.length} bytes`,
      );

      return audioBuffer;
    } catch (error) {
      this.logger.error(
        'Deepgram text-to-speech failed.',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new Error(
        'Failed to generate speech.',
      );
    }
  }
}