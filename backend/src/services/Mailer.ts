import nodemailer, { Transporter } from 'nodemailer';

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
  readonly configured: boolean;
}

/**
 * Resend über die HTTP-API (Port 443 – funktioniert auch, wenn der Server SMTP-Ports blockiert,
 * wie Hetzner bei neuen Servern). Der Absender muss eine in Resend verifizierte Domain nutzen.
 */
export class ResendMailer implements Mailer {
  readonly configured = true;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly apiUrl: string = 'https://api.resend.com',
  ) {}

  async send(to: string, subject: string, text: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject, text }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend-Fehler ${response.status}: ${body}`);
    }
  }
}

/** SMTP über nodemailer (optional, falls kein Resend). */
class SmtpMailer implements Mailer {
  readonly configured = true;
  private readonly transport: Transporter;
  private readonly from: string;

  constructor() {
    let secure = true;
    if (process.env.SMTP_SECURE === 'false') {
      secure = false;
    }
    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    this.from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '';
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    await this.transport.sendMail({ from: this.from, to, subject, text });
  }
}

/** Ohne Resend/SMTP-Konfiguration: nur ins Log schreiben und merken (Entwicklung, Tests). */
export class ConsoleMailer implements Mailer {
  readonly configured = false;
  readonly sent: { to: string; subject: string; text: string }[] = [];

  async send(to: string, subject: string, text: string): Promise<void> {
    this.sent.push({ to, subject, text });
    console.log(`[mail] an ${to}: ${subject}\n${text}`);
  }
}

let instance: Mailer | undefined;

export function getMailer(): Mailer {
  if (!instance) {
    if (process.env.RESEND_API_KEY) {
      instance = new ResendMailer(
        process.env.RESEND_API_KEY,
        process.env.MAIL_FROM ?? 'Fixkosten <onboarding@resend.dev>',
        process.env.RESEND_API_URL ?? 'https://api.resend.com',
      );
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      instance = new SmtpMailer();
    } else {
      instance = new ConsoleMailer();
    }
  }
  return instance;
}
