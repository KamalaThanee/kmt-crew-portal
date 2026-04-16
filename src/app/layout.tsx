import './globals.css'
import Navbar from '../components/Navbar'

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
      <body className="bg-gray-50 min-h-screen">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
