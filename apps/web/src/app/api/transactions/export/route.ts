import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { unauthorized } from '@/lib/http';
import { toTransactionsCsv } from '@/lib/csv/transactions';
import { fetchTransferGroupRows } from '@/lib/transfer-group-fetch';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;
  const { outgoing: rows, incoming } = await fetchTransferGroupRows({
    userId,
    baseWhere: { userId },
    fetchOutgoing: (where) => prisma.transaction.findMany({
      where,
      include: { account: { select: { label: true } }, category: { select: { name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    fetchIncoming: (where) => prisma.transaction.findMany({
      where,
      select: { transferGroupId: true, accountId: true, account: { select: { label: true } } },
    }),
  });
  const incomingByGroup = new Map(
    incoming.flatMap((row) =>
      row.transferGroupId ? [[row.transferGroupId, { accountId: row.accountId, account: row.account }] as const] : [],
    ),
  );
  const csv = toTransactionsCsv(rows, incomingByGroup);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="faura-farmer-transactions.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
