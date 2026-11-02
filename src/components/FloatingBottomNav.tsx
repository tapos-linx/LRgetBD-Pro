import React from 'react';
import { Home, Calendar, CheckSquare, Settings } from 'lucide-react';

export const FloatingBottomNav = () => {
  return (
    <div className="fixed bottom-6 left-6 right-6 z-50">
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md border border-white/50 rounded-full px-8 py-4 shadow-xl">
         <Home className="text-brand-indigo" />
         <Calendar className="text-text-secondary" />
         <CheckSquare className="text-text-secondary" />
         <Settings className="text-text-secondary" />
      </div>
    </div>
  );
};
