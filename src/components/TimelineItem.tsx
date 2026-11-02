import React from 'react';

interface TimelineItemProps {
  time: string;
  title: string;
  surfaceTone?: 'blue' | 'yellow' | 'green';
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  time,
  title,
  surfaceTone = 'blue',
}) => {
  const surfaceClass =
    surfaceTone === 'yellow'
      ? 'bg-surface-pastel-yellow'
      : surfaceTone === 'green'
      ? 'bg-surface-pastel-green'
      : 'bg-surface-pastel-blue';

  return (
    <div className={`flex gap-4 p-4 rounded-2xl ${surfaceClass}`}>
      <div className="text-text-secondary font-medium w-16">{time}</div>
      <div className="text-text-primary font-bold">{title}</div>
    </div>
  );
};

