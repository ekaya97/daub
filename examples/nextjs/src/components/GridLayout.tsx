'use client';

export function GridLayout() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900">Revenue</h3>
        <p className="text-3xl font-bold text-blue-600 mt-2">$48,200</p>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900">Users</h3>
        <p className="text-3xl font-bold text-green-600 mt-2">1,429</p>
      </div>
    </div>
  );
}
