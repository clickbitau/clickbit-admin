import { CustomerLayout } from '@/components/customer/CustomerLayout';

export default function CustomerRootLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLayout>{children}</CustomerLayout>;
}
