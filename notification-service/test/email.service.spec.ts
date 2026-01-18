const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  createTransport: jest.fn(),
}));

import * as nodemailer from 'nodemailer';
import { EmailService } from '../src/email.service';

describe('EmailService', () => {
  it('builds and sends email for order.confirmed', async () => {
    const sendMail = jest.fn().mockResolvedValue(true);

    // IMPORTANT: mock return pentru createTransport
    (nodemailer.createTransport as unknown as jest.Mock).mockReturnValue({
      sendMail,
    });

    process.env.SMTP_HOST = 'mailpit';
    process.env.SMTP_PORT = '1025';
    process.env.MAIL_FROM = 'no-reply@school.local';

    const svc = new EmailService();

    await svc.sendOrderConfirmed({
      eventId: 'e1',
      occurredAt: new Date().toISOString(),
      type: 'order.confirmed',
      data: {
        orderId: 'o1',
        orderDate: '2026-01-18',
        child: { id: 'c1', name: 'Ana', class: '1A' },
        parent: { sub: 'p1', email: 'ana@test.com' },
        menu: { soup: 'Supa', main: 'Fel', dessert: 'Desert' },
      },
    });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);

    const args = sendMail.mock.calls[0][0];
    expect(args.to).toBe('ana@test.com');
    expect(args.from).toBe('no-reply@school.local');
    expect(args.subject).toContain('Comandă confirmată');
    expect(args.text).toContain('Order ID: o1');
  });
});
