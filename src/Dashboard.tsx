import React from 'react';
import { TaskCard } from './components/TaskCard';
import { FloatingBottomNav } from './components/FloatingBottomNav';
import { DateSlider } from './components/DateSlider';
import { TimelineItem } from './components/TimelineItem';

export const Dashboard = () => {
  return (
    <div className="min-h-screen bg-app-bg p-6 pb-24">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Hello, Alex!</h1>
        <div className="w-12 h-12 rounded-full bg-surface-bg border border-slate-200" />
      </header>
      
      <DateSlider />
      
      <div className="grid grid-cols-2 gap-4 mt-8">
        <TaskCard 
          title="Team Meeting" 
          team="Design Team" 
          avatars={['https://i.pravatar.cc/100?u=1', 'https://i.pravatar.cc/100?u=2']} 
          variant="indigo" 
        />
        <TaskCard 
          title="UI Design" 
          team="Product Team" 
          avatars={['https://i.pravatar.cc/100?u=3']} 
          variant="crimson" 
        />
      </div>

      <div className="mt-8 space-y-3">
        <h2 className="text-xl font-bold text-text-primary mb-4">Today's Timeline</h2>
        <TimelineItem time="10:00" title="Wireframing" />
        <TimelineItem time="14:00" title="Client Review" />
      </div>

      <FloatingBottomNav />
    </div>
  );
};
