export function GridLayout() {
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-3">
      <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900">Revenue Overview</h3>
        <p className="text-3xl font-bold text-blue-600 mt-2">$48,200</p>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900">Active Users</h3>
        <p className="text-3xl font-bold text-green-600 mt-2">1,429</p>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900">Conversion</h3>
        <p className="text-3xl font-bold text-purple-600 mt-2">3.2%</p>
      </div>
      <div className="col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h3 className="font-semibold text-orange-900">Recent Activity</h3>
        <p className="text-sm text-orange-700 mt-2">12 new sign-ups in the last hour</p>
      </div>
    </div>
  );
}
