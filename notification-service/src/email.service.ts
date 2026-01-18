import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type OrderConfirmedEvent = {
  eventId: string;
  occurredAt: string;
  type: 'order.confirmed';
  data: {
    orderId: string;
    orderDate: string;
    child: { id: string; name: string; class: string };
    parent: { sub: string; email: string };
    menu?: {
      soup?: string;
      main?: string;
      dessert?: string;
      reserve?: string;
    };
  };
};

@Injectable()
export class EmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 1025),
    secure: false,
  });

  async sendOrderConfirmed(evt: OrderConfirmedEvent) {
    const to = evt.data.parent.email;
    const from = process.env.MAIL_FROM || 'no-reply@school.local';

    const subject = `Comandă confirmată – ${evt.data.child.name} – ${evt.data.orderDate}`;

    const m = evt.data.menu || {};
    const text = `Comanda a fost confirmată.

Copil: ${evt.data.child.name} (${evt.data.child.class})
Data: ${evt.data.orderDate}

Meniu:
- Supă: ${m.soup || '-'}
- Fel principal: ${m.main || '-'}
- Desert: ${m.dessert || '-'}
- Rezervă: ${m.reserve || '-'}

Order ID: ${evt.data.orderId}
Event ID: ${evt.eventId}
`;

    await this.transporter.sendMail({ to, from, subject, text });
  }
}
