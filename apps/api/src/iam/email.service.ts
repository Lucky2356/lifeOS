import { Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../common/logger';

/** Экранирование пользовательского текста перед вставкой в HTML-тело письма (против инъекции разметки). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Отправка писем через универсальный SMTP (подходит любой провайдер: Brevo, Gmail, Mailgun и т.п.).
 * Настраивается переменными окружения: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Если SMTP не задан — письмо не уходит, а ссылка пишется в лог (локальная разработка).
 */
@Injectable()
export class EmailService {
  private readonly from = process.env.SMTP_FROM ?? 'Life OS <no-reply@lifeos.local>';
  private readonly transport: Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      const port = Number(process.env.SMTP_PORT ?? 587);
      this.transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
    } else {
      this.transport = null;
    }
  }

  get configured(): boolean {
    return this.transport !== null;
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const subject = 'Сброс пароля в Life OS';
    const text =
      `Вы (или кто-то) запросили сброс пароля в Life OS.\n\n` +
      `Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n${resetUrl}\n\n` +
      `Если это были не вы — просто проигнорируйте письмо, пароль останется прежним.`;
    const html =
      `<p>Вы (или кто-то) запросили сброс пароля в Life OS.</p>` +
      `<p>Чтобы задать новый пароль, нажмите ссылку (действует 1 час):</p>` +
      `<p><a href="${resetUrl}">Задать новый пароль</a></p>` +
      `<p style="color:#888">Если это были не вы — просто проигнорируйте письмо.</p>`;

    if (!this.transport) {
      // Нет SMTP — не срываем поток, но даём администратору увидеть ссылку в логах.
      logger.warn({ resetUrl }, 'SMTP не настроен — ссылка сброса пароля (не отправлена по почте)');
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }

  /** Дайджест приближающихся дедлайнов. */
  async sendReminderDigest(to: string, items: Array<{ title: string; daysLeft: number }>): Promise<void> {
    const phrase = (d: number) =>
      d < 0 ? `просрочено на ${-d} дн.` : d === 0 ? 'истекает сегодня' : `истекает через ${d} дн.`;
    const appUrl = (process.env.APP_URL ?? 'http://localhost:8080').replace(/\/$/, '');
    const lines = items.map((i) => `• ${i.title} — ${phrase(i.daysLeft)}`).join('\n');
    const htmlLines = items.map((i) => `<li>${escapeHtml(i.title)} — ${phrase(i.daysLeft)}</li>`).join('');
    const subject = `Life OS: ${items.length} ${items.length === 1 ? 'дело требует' : 'дел требуют'} внимания`;
    const text = `Приближаются сроки:\n\n${lines}\n\nОткрыть Life OS: ${appUrl}`;
    const html =
      `<p>Приближаются сроки:</p><ul>${htmlLines}</ul>` + `<p><a href="${appUrl}">Открыть Life OS</a></p>`;

    if (!this.transport) {
      logger.warn({ items }, 'SMTP не настроен — дайджест напоминаний (не отправлен по почте)');
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }
}
