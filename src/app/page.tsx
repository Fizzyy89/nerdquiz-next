'use client';

import { useSocket } from '@/hooks/useSocket';
import { DevPanel } from '@/components/dev/DevPanel';
import { HomeScreen } from '@/components/screens';

export default function HomePage() {
  // Initialize socket connection
  useSocket();

  return (
    <>
      <HomeScreen />
      
      {/* Dev Panel - only shows in development mode */}
      <DevPanel />
    </>
  );
}
