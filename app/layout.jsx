import './globals.css'

export const metadata = {
  title: 'Calendar App',
  description: 'Collaborative class scheduling',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}