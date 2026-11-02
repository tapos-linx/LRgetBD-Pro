import React from 'react';
import { motion } from 'motion/react';

interface TaskCardProps {
  title: string;
  team: string;
  avatars: string[];
  variant: 'indigo' | 'crimson';
}

export const TaskCard: React.FC<TaskCardProps> = ({ title, team, avatars, variant }) => {
  const isIndigo = variant === 'indigo';
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-6 rounded-[28px] ${isIndigo ? 'bg-brand-indigo' : 'bg-accent-pink'} text-white shadow-lg`}
      style={{
        boxShadow: `0 10px 25px -5px ${isIndigo ? 'rgba(39, 49, 241, 0.3)' : 'rgba(200, 67, 83, 0.3)'}`
      }}
    >
      <div className="text-xs opacity-80 mb-2">{team}</div>
      <h3 className="text-xl font-bold mb-6">{title}</h3>
      
      <div className="flex -space-x-3">
        {avatars.map((avatar, i) => (
          <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden bg-white/10">
             <img src={avatar} alt="Team member" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </motion.div>
  );
};
