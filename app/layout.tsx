import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'TaskFlow AI | Your day, organized', description: 'A modern task manager with voice tasks and private audio notes.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
