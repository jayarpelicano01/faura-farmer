'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SpendingByCategory } from '@faura-farmer/types';
import { formatMoney, toNumber } from '@/lib/format';

interface BarChartProps {
  data: SpendingByCategory[];
}

export function SpendingBarChart({ data }: BarChartProps) {
  const chartData = data.map((item) => ({
    name: item.categoryName,
    amount: toNumber(item.amount),
    fill: item.color ?? '#4a4de7',
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => formatMoney(value).replace('.00', '')} />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Bar dataKey="amount" name="Spent" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}