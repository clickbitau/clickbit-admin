import { redirect } from 'next/navigation';

export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) query.set(key, value.join(','));
    else query.set(key, value);
  }
  const queryString = query.toString();
  redirect(queryString ? `/admin?${queryString}` : '/admin');
}
