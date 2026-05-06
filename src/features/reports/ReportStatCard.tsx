'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportStatCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
  };
  className?: string;
  iconClassName?: string;
}

export function ReportStatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  className,
  iconClassName
}: ReportStatCardProps) {
  return (
    <div className={cn("bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
        <div className={cn("p-1.5 rounded-lg bg-slate-50", iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      
      <div className="flex flex-col mt-1">
        <div className="text-lg font-black text-slate-800 leading-none">{value}</div>
        {subValue && <div className="text-[10px] font-bold text-slate-400 mt-1">{subValue}</div>}
      </div>

      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <span className={cn(
            "text-[10px] font-black px-1.5 py-0.5 rounded-md",
            trend.isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {trend.isUp ? '↑' : '↓'} {trend.value}%
          </span>
          <span className="text-[10px] font-medium text-slate-400">vs bln lalu</span>
        </div>
      )}
    </div>
  );
}
