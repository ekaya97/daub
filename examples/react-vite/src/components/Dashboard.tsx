import { ProfileHeader } from './ProfileHeader';
import { CardGrid } from './CardGrid';
import { Sidebar } from './Sidebar';
import { GridLayout } from './GridLayout';
import { ColorSection } from './ColorSection';

export function Dashboard() {
  return (
    <div className="flex gap-6 p-6 max-w-7xl mx-auto">
      <Sidebar />
      <main className="flex-1 space-y-6">
        <ProfileHeader />
        <GridLayout />
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Features</h2>
          <CardGrid />
        </section>
        <ColorSection />
      </main>
    </div>
  );
}
