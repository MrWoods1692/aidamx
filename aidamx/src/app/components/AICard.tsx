'use client';

import { ReactNode } from 'react';

interface AICardProps {
  title: string;
  description: string;
  icon: ReactNode;
  highlight?: boolean;
  onClick?: () => void;
}

export default function AICard({
  title,
  description,
  icon,
  highlight = false,
  onClick,
}: AICardProps) {
  return (
    <div
      className={`ai-card cursor-pointer ${
        highlight ? 'border-[rgb(var(--primary-color))]' : ''
      }`}
      style={highlight ? { boxShadow: '0 0 0 2px rgba(var(--primary-color), 0.2)' } : {}}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="text-[rgb(var(--primary-color))] text-2xl mt-1">{icon}</div>
        <div>
          <h3 className="font-medium text-lg">{title}</h3>
          <p className="text-[rgb(var(--text-secondary))] text-sm mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
} 