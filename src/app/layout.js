import './globals.css';

export const metadata = {
  title: 'Gmail Mailer — Enterprise Email Sending Module',
  description: 'Enterprise Gmail Email Sending Platform — OAuth2, App Password, Outlook & SMTP · AI anti-spam · subject rotation · bulk campaigns',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
