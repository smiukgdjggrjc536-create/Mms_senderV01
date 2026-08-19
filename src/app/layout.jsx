import './globals.css';

export const metadata = {
  title: 'Enterprise SMS SaaS',
  description: 'Advanced SMS Routing and Management System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
