import { EmployeeLayout } from '@/components/employee/EmployeeLayout';

export default function EmployeeRootLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeLayout>{children}</EmployeeLayout>;
}
