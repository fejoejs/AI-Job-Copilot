/**
 * WhatsApp Business Cloud API Service
 * 
 * Sends messages from your registered WhatsApp Business Account (e.g. "AI Job Copilot")
 * using Meta's WhatsApp Cloud API. Messages appear from your business name and logo,
 * not a personal phone number.
 * 
 * Setup:
 * 1. Create a Meta Business Account at business.facebook.com
 * 2. Enable WhatsApp Business API in Meta for Developers
 * 3. Get your Phone Number ID, Business Account ID, and Access Token
 * 4. Register your business display name (e.g. "AI Job Copilot")
 * 5. Create message templates for OTP and Job Match notifications
 */

export interface WhatsAppConfig {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
}

export class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private baseUrl: string;

  constructor(config?: WhatsAppConfig) {
    this.accessToken = config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const apiVersion = config?.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${apiVersion}/${this.phoneNumberId}/messages`;
  }

  private get isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  /**
   * Send a raw text message to a WhatsApp number
   */
  async sendTextMessage(to: string, message: string): Promise<any> {
    if (!this.isConfigured) {
      console.log(`[WhatsApp Mock] To: ${to}`);
      console.log(`[WhatsApp Mock] Message: ${message}`);
      return { mock: true, to, message };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/[^0-9]/g, ''), // strip non-numeric chars
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`WhatsApp API error (${response.status}):`, errBody);
        throw new Error(`WhatsApp send failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('WhatsApp message send failed:', error);
      throw error;
    }
  }

  /**
   * Send OTP verification code
   * Appears as: "AI Job Copilot: Your verification code is 123456. Valid for 10 minutes."
   */
  async sendOtp(to: string, otp: string): Promise<any> {
    const message = `🔐 *AI Job Copilot*\n\nYour verification code is: *${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
    return this.sendTextMessage(to, message);
  }

  /**
   * Send a job match notification with apply instructions
   * Appears from the business name "AI Job Copilot"
   */
  async sendJobMatchNotification(
    to: string,
    jobTitle: string,
    company: string,
    matchScore: number,
    salary: string,
    applicationId: string,
  ): Promise<any> {
    const message = [
      `🚀 *AI Job Copilot - New Match Found!*`,
      ``,
      `📋 *${jobTitle}*`,
      `🏢 ${company}`,
      `📊 Match Score: *${matchScore}%*`,
      salary ? `💰 Salary: ${salary}` : '',
      ``,
      `Your tailored resume and cover letter are ready.`,
      ``,
      `👉 Reply *APPLY ${applicationId}* to auto-apply now`,
      `👉 Reply *SKIP* to dismiss`,
      ``,
      `Or open your dashboard to review details.`,
    ].filter(Boolean).join('\n');

    return this.sendTextMessage(to, message);
  }

  /**
   * Send application status update
   */
  async sendApplicationUpdate(
    to: string,
    jobTitle: string,
    company: string,
    status: string,
  ): Promise<any> {
    const emoji = status === 'Applied' ? '✅' : status === 'Interviewing' ? '🎯' : '📌';
    const message = [
      `${emoji} *AI Job Copilot - Application Update*`,
      ``,
      `Your application for *${jobTitle}* at *${company}* has been updated:`,
      ``,
      `Status: *${status}*`,
      ``,
      status === 'Applied'
        ? `Your tailored resume and cover letter were submitted successfully.`
        : `Check your dashboard for more details.`,
    ].join('\n');

    return this.sendTextMessage(to, message);
  }

  /**
   * Verify the webhook signature from Meta (for incoming messages)
   */
  static verifyWebhookSignature(
    signature: string,
    body: string,
    appSecret: string,
  ): boolean {
    try {
      // In production, use crypto.createHmac('sha256', appSecret).update(body).digest('hex')
      // and compare with the signature header
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', appSecret)
        .update(body)
        .digest('hex');
      return `sha256=${expectedSignature}` === signature;
    } catch {
      return false;
    }
  }

  /**
   * Parse incoming webhook payload to extract message text and sender
   */
  static parseIncomingMessage(body: any): { from: string; text: string } | null {
    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      
      if (!message || message.type !== 'text') return null;

      return {
        from: message.from, // sender phone number
        text: message.text?.body?.trim() || '',
      };
    } catch {
      return null;
    }
  }
}
