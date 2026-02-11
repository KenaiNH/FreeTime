import './globals.css'

export const metadata = {
  title: 'FreeTime',
  description: 'Collaborative class scheduling',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
