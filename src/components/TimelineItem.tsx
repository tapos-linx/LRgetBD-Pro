import React from 'react';

interface TimelineItemProps {
  time: string;
  title: string;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ time, title }) => {
  return (
    <div className="flex gap-4 p-4 rounded-2xl bg-brand-indigo/[0.08]">
      <div className="text-text-secondary font-medium w-16">{time}</div>
      <div className="text-text-primary font-bold">{title}</div>
    </div>
  );
};
