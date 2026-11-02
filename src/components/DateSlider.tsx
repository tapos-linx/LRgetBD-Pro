import React from 'react';

export const DateSlider = () => {
  const dates = ['12 Mon', '13 Tue', '14 Wed', '15 Thu', '16 Fri', '17 Sat'];
  return (
    <div className="flex gap-4 overflow-x-auto p-4 no-scrollbar">
      {dates.map((date, i) => (
        <button key={i} className={`px-6 py-3 rounded-full ${i === 1 ? 'bg-brand-indigo text-white' : 'bg-surface-bg text-text-secondary'} transition-colors`}>
          {date}
        </button>
      ))}
    </div>
  );
};
