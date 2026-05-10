const items = [
  'Dashboard', 'Projects', 'Team', 'Calendar',
  'Documents', 'Reports', 'Settings', 'Billing',
  'Notifications', 'Integrations', 'API Keys', 'Logs',
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-gray-900 text-gray-300 rounded-lg overflow-y-auto h-[calc(100vh-8rem)]">
      <div className="p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Navigation</h2>
        <nav className="space-y-1">
          {items.map((item, i) => (
            <a
              key={item}
              href="#"
              className={`block px-3 py-2 rounded-md text-sm ${
                i === 0
                  ? 'bg-gray-800 text-white font-medium'
                  : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
