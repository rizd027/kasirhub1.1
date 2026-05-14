'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface SalesChartProps {
  data: { day: string; total: number }[];
}

export function SalesChart({ data }: SalesChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return <div className="h-[220px] w-full bg-slate-50 animate-pulse rounded-lg" />;

  return (
    <div className="h-[220px] w-full mt-4">
      <ResponsiveContainer width="100%" height={220} debounce={50}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
              fontWeight: 800
            }}
            formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Penjualan']}
          />
          <Bar 
            dataKey="total" 
            radius={[6, 6, 0, 0]} 
            barSize={24}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index === data.length - 1 ? '#4f46e5' : '#e2e8f0'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

