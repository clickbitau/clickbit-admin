'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinanceIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/finance/invoices');
  }, [router]);
  return null;
}
