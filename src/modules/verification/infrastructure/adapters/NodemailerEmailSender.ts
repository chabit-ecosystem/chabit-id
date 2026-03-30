import nodemailer from 'nodemailer';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';
import { EmailSender } from '../../domain/ports/EmailSender.port.js';
import { EmailDeliveryError } from '../../domain/errors/Verification.errors.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export class NodemailerEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      tls: { rejectUnauthorized: false },
      ...(config.user && config.pass
        ? { auth: { user: config.user, pass: config.pass } }
        : {}),
    });
  }

  async sendOtp(email: Email, code: OtpCode): Promise<void> {
    const recipient = email.toPrimitive();
    const otp = code.toPrimitive();

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        subject: `Tu código de verificación: ${otp}`,
        text: [
          `Tu código de verificación para Chabit es: ${otp}`,
          '',
          'Válido por 10 minutos.',
          'Si no solicitaste este código, ignorá este mensaje.',
        ].join('\n'),
      });
    } catch {
      throw new EmailDeliveryError(recipient);
    }
  }
}
