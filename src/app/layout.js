import "./globals.css";

export const metadata = {
  title: "SMS Campaign System",
  description: "SMS Campaign Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
