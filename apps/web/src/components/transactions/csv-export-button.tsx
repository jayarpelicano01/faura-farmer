'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CsvExportButton() {
  return (
    <Button variant="outline" asChild>
      <a href="/api/transactions/export" download="faura-farmer-transactions.csv">
        <Download /> Export CSV
      </a>
    </Button>
  );
}
