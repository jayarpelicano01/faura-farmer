'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyTrendPoint } from '@faura-farmer/types';
import { formatMoney, toNumber } from '@/lib/format';

interface TrendChartProps {
  data: MonthlyTrendPoint[];
}

export function TrendLineChart({ data }: TrendChartProps) {
  const chartData = data.map((point) => ({
    month: point.month,
    income: toNumber(point.income),
    expense: toNumber(point.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => formatMoney(value).replace('.00', '')} />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Legend />
        <Line type="monotone" dataKey="income" name="Income" stroke="hsl(var(--income))" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="expense" name="Expense" stroke="hsl(var(--expense))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}