'use client';

export function ProfileHeader() {
  return (
    <div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xl font-bold">
        JD
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Jane Doe</h1>
        <p className="text-sm text-gray-500 tracking-wide">Senior Product Designer</p>
        <p className="text-xs text-gray-400 mt-1">San Francisco, CA</p>
      </div>
    </div>
  );
}
