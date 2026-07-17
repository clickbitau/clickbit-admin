import { AgentLayout } from '@/components/agent/AgentLayout';

export default function AgentRootLayout({ children }: { children: React.ReactNode }) {
  return <AgentLayout>{children}</AgentLayout>;
}
