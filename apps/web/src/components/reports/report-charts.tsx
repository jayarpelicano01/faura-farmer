'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDisplayCurrency } from '@/components/currency/display-currency-provider';

type BalancePoint = {
  id: string; label: string; from: string; to: string; balance: string; change: string;
  events: Array<{ id: string; date: string; description: string; amount: string; type: string }>;
};
type CategoryRow = { categoryName: string; color: string | null; amount: string };

export function BalanceMovementChart({ data }: { data: BalancePoint[] }) {
  const { displayCurrency, formatMoney } = useDisplayCurrency();
  const [selectedId, setSelectedId] = useState<string | null>(data.at(-1)?.id ?? null);
  const selected = data.find((point) => point.id === selectedId) ?? data.at(-1);
  const chartData = data.map((point) => ({ ...point, value: Number(point.balance) }));
  if (!data.length) return <p className="py-6 text-sm text-muted-foreground">No transactions in this period.</p>;
  return <div className="space-y-4">
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }} onClick={(state) => {
        const point = state.activePayload?.[0]?.payload as BalancePoint | undefined;
        if (point) setSelectedId(point.id);
      }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => formatMoney(value, displayCurrency).replace(/\.00$/, '')} />
        <Tooltip formatter={(value) => formatMoney(Number(value), displayCurrency)} labelFormatter={(_, payload) => {
          const point = payload[0]?.payload as BalancePoint | undefined;
          return point ? `${point.from} to ${point.to}` : '';
        }} />
        <Line type="monotone" dataKey="value" name="Closing balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
    {selected ? <div className="rounded-lg border bg-muted/30 p-4">
      <p className="font-medium text-foreground">Movement for {selected.from === selected.to ? selected.from : `${selected.from} to ${selected.to}`}</p>
      <p className="mt-1 text-sm text-muted-foreground">Closing balance {formatMoney(selected.balance, displayCurrency)}</p>
      {selected.events.length ? <div className="mt-3 space-y-2">
        {selected.events.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0"><span className="block truncate font-medium">{event.description}</span><span className="text-muted-foreground">{event.date} · {event.type.replace('_', ' ')}</span></span>
          <span className={Number(event.amount) < 0 ? 'text-expense' : 'text-income'}>{Number(event.amount) > 0 ? '+' : ''}{formatMoney(event.amount, displayCurrency)}</span>
        </div>)}
      </div> : <p className="mt-3 text-sm text-muted-foreground">No transactions changed this balance point.</p>}
    </div> : null}
  </div>;
}

export function CategorySpendingChart({ data }: { data: CategoryRow[] }) {
  const { displayCurrency, formatMoney } = useDisplayCurrency();
  if (!data.length) return <p className="py-6 text-sm text-muted-foreground">No transactions in this period.</p>;
  const chartData = data.map((item) => ({ ...item, value: Number(item.amount) }));
  return <ResponsiveContainer width="100%" height={280}>
    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 42 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="categoryName" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" />
      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => formatMoney(value, displayCurrency).replace(/\.00$/, '')} />
      <Tooltip formatter={(value) => formatMoney(Number(value), displayCurrency)} />
      <Bar dataKey="value" name="Spent" radius={[4, 4, 0, 0]}>{chartData.map((item) => <Cell key={item.categoryName} fill={item.color ?? 'hsl(var(--primary))'} />)}</Bar>
    </BarChart>
  </ResponsiveContainer>;
}
