'use client';

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}

const cards = [
  { title: 'Analytics', description: 'Track user behavior and engagement metrics.' },
  { title: 'Automation', description: 'Set up automated workflows for your team.' },
  { title: 'Security', description: 'Enterprise-grade security and compliance.' },
  { title: 'Integrations', description: 'Connect with 100+ third-party tools.' },
];

export function CardGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => <Card key={card.title} {...card} />)}
    </div>
  );
}
