import './globals.css';

export const metadata = {
  title: 'WatchAlong — Watch Together in Sync',
  description: 'Create a room, invite friends, and watch YouTube videos or your own files in perfect synchronization.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
