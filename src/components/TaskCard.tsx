import React from 'react';
import { motion } from 'motion/react';
import { THEME_COLORS } from '../config/themeColors';

interface TaskCardProps {
  title: string;
  team: string;
  avatars: string[];
  variant: 'indigo' | 'crimson' | 'deep-red';
  badgeText?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  title,
  team,
  avatars,
  variant,
  badgeText,
}) => {
  const bgClass =
    variant === 'indigo'
      ? 'bg-brand-indigo colored-glow-indigo'
      : variant === 'deep-red'
      ? 'bg-deep-red colored-glow-red'
      : 'bg-accent-pink colored-glow-pink';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-6 rounded-[28px] ${bgClass} text-white`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs opacity-85">{team}</span>
        {badgeText && (
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white-transparent-20 backdrop-blur-sm"
            title={`WhiteTransparent20 (${THEME_COLORS.WhiteTransparent20})`}
          >
            {badgeText}
          </span>
        )}
      </div>
      <h3 className="text-xl font-bold mb-6">{title}</h3>

      <div className="flex -space-x-3">
        {avatars.map((avatar, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-white-transparent-20 overflow-hidden bg-white-transparent-20"
          >
            <img
              src={avatar}
              alt="Team member"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
};

