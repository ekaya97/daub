import { Card } from './Card';

const cards = [
  { title: 'Analytics', description: 'Track user behavior and engagement metrics.' },
  { title: 'Automation', description: 'Set up automated workflows for your team.' },
  { title: 'Security', description: 'Enterprise-grade security and compliance.' },
  { title: 'Integrations', description: 'Connect with 100+ third-party tools.' },
  { title: 'Reporting', description: 'Generate custom reports and dashboards.' },
  { title: 'Support', description: '24/7 priority support with dedicated CSM.' },
];

export function CardGrid() {
  return (
    <div className="flex flex-wrap gap-4">
      {cards.map((card) => (
        <div key={card.title} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]">
          <Card {...card} />
        </div>
      ))}
    </div>
  );
}
