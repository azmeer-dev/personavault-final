type EmailOptions = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail({ to, subject, body }: EmailOptions): Promise<void> {
  // Implement actual email logic here if needed
  console.log(`Sending email to ${to} - ${subject}: ${body}`);
}
