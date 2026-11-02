import React from 'react';
import { TaskCard } from './components/TaskCard';
import { FloatingBottomNav } from './components/FloatingBottomNav';
import { DateSlider } from './components/DateSlider';
import { TimelineItem } from './components/TimelineItem';

export const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background-white p-6 pb-24">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Hello, Alex!</h1>
        <div className="w-12 h-12 rounded-full bg-surface-off-white border border-slate-200" />
      </header>

      <DateSlider />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <TaskCard
          title="Team Meeting"
          team="Design Team"
          badgeText="Indigo"
          avatars={[
            'https://i.pravatar.cc/100?u=1',
            'https://i.pravatar.cc/100?u=2',
          ]}
          variant="indigo"
        />
        <TaskCard
          title="UI Design"
          team="Product Team"
          badgeText="Pink"
          avatars={['https://i.pravatar.cc/100?u=3']}
          variant="crimson"
        />
        <TaskCard
          title="Release Audit"
          team="QA & Security"
          badgeText="Urgent"
          avatars={['https://i.pravatar.cc/100?u=4']}
          variant="deep-red"
        />
      </div>

      <div className="mt-8 space-y-3">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          Today&apos;s Timeline
        </h2>
        <TimelineItem
          time="10:00"
          title="Wireframing"
          surfaceTone="blue"
        />
        <TimelineItem
          time="12:30"
          title="Design System Review"
          surfaceTone="yellow"
        />
        <TimelineItem
          time="14:00"
          title="Client Review"
          surfaceTone="green"
        />
      </div>

      <FloatingBottomNav />
    </div>
  );
};

