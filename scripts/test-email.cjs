// Load environment variables
require('dotenv').config();

// Since we're using TypeScript, we need to use a different approach
// We'll create a simple test that mimics the email functionality

const { Resend } = require('resend');

async function testEmail() {
  console.log('Testing email functionality...');
  
  // Check if required environment variables are set
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set in environment variables');
    return;
  }
  
  if (!process.env.FROM_EMAIL) {
    console.error('❌ FROM_EMAIL is not set in environment variables');
    console.log('💡 You can set it temporarily for testing, e.g.: FROM_EMAIL="CouponCycle <test@yourdomain.com>"');
    return;
  }
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const testEmailOptions = {
    from: process.env.FROM_EMAIL,
    to: 'fantasychen2016@gmail.com',
    subject: 'Test Email from CouponCycle',
    html: `
      <h1>Hello from CouponCycle!</h1>
      <p>This is a test email to verify that our email system is working correctly.</p>
      <p>If you're receiving this, it means:</p>
      <ul>
        <li>✅ Resend integration is working</li>
        <li>✅ Email sending functionality is operational</li>
        <li>✅ Your domain configuration is correct</li>
      </ul>
      <p>Best regards,<br>The CouponCycle Team</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        This is a test email sent from your CouponCycle application.
      </p>
    `,
    text: `
Hello from CouponCycle!

This is a test email to verify that our email system is working correctly.

If you're receiving this, it means:
- Resend integration is working
- Email sending functionality is operational  
- Your domain configuration is correct

Best regards,
The CouponCycle Team

---
This is a test email sent from your CouponCycle application.
    `
  };

  try {
    console.log('📤 Sending email...');
    console.log('📧 From:', testEmailOptions.from);
    console.log('📧 To:', testEmailOptions.to);
    console.log('📝 Subject:', testEmailOptions.subject);
    
    const { data, error } = await resend.emails.send(testEmailOptions);
    
    if (error) {
      console.error('❌ Error sending email:', error);
      return;
    }
    
    console.log('✅ Test email sent successfully!');
    console.log('📬 Email ID:', data?.id);
    
  } catch (error) {
    console.error('❌ Error sending test email:', error);
  }
}

// Run the test
testEmail().catch(console.error); 