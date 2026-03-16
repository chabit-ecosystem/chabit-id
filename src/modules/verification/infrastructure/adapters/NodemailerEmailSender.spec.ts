import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EmailDeliveryError } from '../../domain/errors/Verification.errors.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';

// Mock nodemailer ANTES de importar el adaptador
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

// Importar DESPUÉS del mock
const { NodemailerEmailSender } = await import('./NodemailerEmailSender.js');

const BASE_CONFIG = {
  host: 'localhost',
  port: 25,
  secure: false,
  from: 'noreply@chabit.com',
};

describe('NodemailerEmailSender', () => {
  beforeEach(() => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
  });

  it('llama a sendMail con el destinatario correcto', async () => {
    const sender = new NodemailerEmailSender(BASE_CONFIG);
    await sender.sendOtp(
      Email.fromPrimitive('user@example.com'),
      OtpCode.fromPrimitive('123456'),
    );

    expect(mockSendMail).toHaveBeenCalledOnce();
    const call = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(call['to']).toBe('user@example.com');
    expect(call['from']).toBe('noreply@chabit.com');
  });

  it('incluye el código OTP en el cuerpo del email', async () => {
    const sender = new NodemailerEmailSender(BASE_CONFIG);
    await sender.sendOtp(
      Email.fromPrimitive('user@example.com'),
      OtpCode.fromPrimitive('654321'),
    );

    const call = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    const body = String(call['text'] ?? call['html'] ?? '');
    expect(body).toContain('654321');
  });

  it('lanza EmailDeliveryError cuando el transporte falla', async () => {
    mockSendMail.mockRejectedValue(new Error('Connection refused'));
    const sender = new NodemailerEmailSender(BASE_CONFIG);

    await expect(
      sender.sendOtp(
        Email.fromPrimitive('user@example.com'),
        OtpCode.fromPrimitive('123456'),
      ),
    ).rejects.toThrow(EmailDeliveryError);
  });
});
