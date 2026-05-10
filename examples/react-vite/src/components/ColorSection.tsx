export function ColorSection() {
  return (
    <div
      className="rounded-lg p-6"
      style={{ backgroundColor: '#1e1b4b', color: '#c7d2fe', borderColor: '#4338ca' }}
    >
      <h3 className="text-lg font-semibold" style={{ color: '#e0e7ff' }}>
        Design System Colors
      </h3>
      <div className="flex gap-3 mt-4">
        {['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'].map((color) => (
          <div
            key={color}
            className="w-10 h-10 rounded-full border-2"
            style={{ backgroundColor: color, borderColor: 'rgba(255,255,255,0.2)' }}
          />
        ))}
      </div>
      <p className="text-sm mt-4 opacity-80">Click any swatch to copy its hex value.</p>
    </div>
  );
}
