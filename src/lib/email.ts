import { Resend } from 'resend';

// Lazy instantiation to avoid errors during build time when env vars aren't available
let resendInstance: Resend | null = null;
function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string; // For HTML emails
  text?: string; // Optional plain text version
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: EmailOptions): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set. Email not sent.');
    // In a real app, you might want to throw an error or handle this more gracefully
    // For local development without sending actual emails, you could just log and return true.
    if (process.env.NODE_ENV !== 'production') {
      console.log('Development mode: Email would have been sent with subject:', subject);
      console.log('To:', to);
      // console.log('HTML:', html);
      return true; // Simulate success in dev if key is missing for testing UI flow
    }
    return false;
  }

  const fromEmail = process.env.FROM_EMAIL;
  if (!fromEmail) {
    console.error('FROM_EMAIL is not set. Email not sent.');
    if (process.env.NODE_ENV !== 'production') {
      console.log('Development mode: Email would have been sent with subject:', subject);
      return true;
    }
    return false;
  }

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: fromEmail, // e.g., 'CouponCycle <notifications@yourdomain.com>'
      to: to,
      subject: subject,
      html: html,
      text: text, // Optional text version
    });

    if (error) {
      console.error('Error sending email:', error);
      return false;
    }

    console.log('Email sent successfully! ID:', data?.id);
    return true;
  } catch (e) {
    const error = e as Error;
    console.error('Failed to send email:', error.message);
    return false;
  }
} 