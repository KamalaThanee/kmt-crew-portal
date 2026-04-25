import './globals.css'
import Navbar from './Navbar'

export const metadata = {
  title: 'KMT Crew Portal',
  description: 'PPE Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">{children}</main>
      </body>
    </html>
  )
}
