'use client';

import { useRouter } from 'next/navigation';
import { RefreshCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorCardProps {
  reset?: () => void;
  className?: string;
}

function ErrorCard({ reset, className }: ErrorCardProps) {
  const router = useRouter();

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-expense/15">
          <TriangleAlert className="h-6 w-6 text-expense" />
        </span>
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold text-foreground">
            Something went wrong
          </p>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while loading this page.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {reset && (
            <Button onClick={() => reset()}>
              <RefreshCcw className="h-4 w-4" />
              Try again
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/')}>
            Go to dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { ErrorCard };