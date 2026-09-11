import type { Prisma } from '@faura-farmer/database';

type TransferGroupRow = {
  transferGroupId: string | null;
};

type FetchTransferGroupRowsOptions<TOutgoing extends TransferGroupRow, TIncoming, TMetadata> = {
  userId: string;
  baseWhere: Prisma.TransactionWhereInput;
  fetchMetadata?: (where: Prisma.TransactionWhereInput) => Promise<TMetadata>;
  fetchOutgoing: (where: Prisma.TransactionWhereInput) => Promise<TOutgoing[]>;
  fetchIncoming: (where: Prisma.TransactionWhereInput) => Promise<TIncoming[]>;
};

/**
 * Fetch logical outgoing transaction rows and their matching incoming legs.
 *
 * Projection and ordering stay with each caller while user scoping and the
 * transfer-group discovery sequence live in one place.
 */
export async function fetchTransferGroupRows<
  TOutgoing extends TransferGroupRow,
  TIncoming,
  TMetadata = undefined,
>(
  options: FetchTransferGroupRowsOptions<TOutgoing, TIncoming, TMetadata>,
): Promise<{ outgoing: TOutgoing[]; incoming: TIncoming[]; metadata: TMetadata | undefined }> {
  const outgoingWhere: Prisma.TransactionWhereInput = {
    AND: [
      options.baseWhere,
      { OR: [{ transferGroupId: null }, { transferRole: 'outgoing' }] },
    ],
  };
  const [outgoing, metadata] = await Promise.all([
    options.fetchOutgoing(outgoingWhere),
    options.fetchMetadata?.(outgoingWhere),
  ]);
  const groupIds = outgoing.flatMap((row) =>
    row.transferGroupId ? [row.transferGroupId] : [],
  );

  const incoming = groupIds.length > 0
    ? await options.fetchIncoming({
        account: { userId: options.userId },
        transferGroupId: { in: groupIds },
        transferRole: 'incoming',
      })
    : [];

  return { outgoing, incoming, metadata };
}
