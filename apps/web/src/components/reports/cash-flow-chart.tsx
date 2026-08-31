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
import type { CashFlowPoint } from '@faura-farmer/types';
import { formatMoney, toNumber } from '@/lib/format';

interface CashFlowChartProps {
  data: CashFlowPoint[];
  currency: string;
}

export function CashFlowChart({ data, currency }: CashFlowChartProps) {
  const chartData = data.map((point) => ({
    label: point.label,
    income: toNumber(point.income),
    expense: toNumber(point.expense),
    net: toNumber(point.net),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(value: number) => formatMoney(value, currency).replace('.00', '')}
        />
        <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
        <Legend />
        <Line type="monotone" dataKey="income" name="Income" stroke="hsl(var(--income))" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="expense" name="Expenses" stroke="hsl(var(--expense))" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="net" name="Net cash flow" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
