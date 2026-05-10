'use client';

import { ProfileHeader } from '@/components/ProfileHeader';
import { CardGrid } from '@/components/CardGrid';
import { GridLayout } from '@/components/GridLayout';

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Daub — Next.js Example</h1>
      <ProfileHeader />
      <GridLayout />
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Features</h2>
        <CardGrid />
      </section>
    </main>
  );
}
