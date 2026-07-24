'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchAdminBlogPost, updateBlogPost, deleteBlogPost, uploadContentImage } from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/format';
import { ArrowLeft, Save, Trash, BookOpen } from 'lucide-react';
import type { BlogPost } from '@/types/content';

const statuses = ['draft', 'published', 'scheduled', 'archived'];

export default function AdminBlogPostDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Partial<BlogPost>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-blog-post', token, id],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAdminBlogPost(token, id); },
    enabled: !!token && !!id,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<BlogPost>) => updateBlogPost(token!, Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-post', token, id] });
      queryClient.invalidateQueries({ queryKey: ['admin-blog', token] });
      toast.success('Blog post updated');
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update blog post'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBlogPost(token!, Number(id)),
    onSuccess: () => {
      toast.success('Blog post deleted');
      router.push('/admin/content/blog');
    },
    onError: () => toast.error('Failed to delete blog post'),
  });

  const handleSave = () => {
    const payload = { ...form };
    if (Array.isArray(payload.tags)) payload.tags = payload.tags;
    if (Array.isArray(payload.categories)) payload.categories = payload.categories;
    if (!payload.published_at) delete payload.published_at;
    if (!payload.scheduled_at) delete payload.scheduled_at;
    updateMutation.mutate(payload);
  };

  const handleArrayChange = (key: keyof BlogPost, value: string) => {
    const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
    setForm({ ...form, [key]: arr });
  };

  const statusBadge = (status: string) => {
    if (status === 'published') return <Badge variant="default">Published</Badge>;
    if (status === 'draft') return <Badge variant="secondary">Draft</Badge>;
    if (status === 'scheduled') return <Badge variant="outline">Scheduled</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (error) {
    return (
      <PageShell title="Blog Post" icon={BookOpen} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/content/blog"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load blog post.</div>
      </PageShell>
    );
  }

  const post = data;

  return (
    <PageShell
      title={post ? post.title : 'Blog Post'}
      icon={BookOpen}
      description={post ? `/${post.slug}` : ''}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/content/blog"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleSave} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Save</Button>
          )}
        </div>
      }
    >
      {isLoading || !post ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-2xl">{post.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{post.author ? `By ${post.author.first_name} ${post.author.last_name}` : 'No author'}</p>
                  </div>
                  {statusBadge(post.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2"><Label>Title</Label><Input value={String(form.title || '')} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                    <div><Label>Slug</Label><Input value={String(form.slug || '')} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
                    <div><Label>Status</Label>
                      <select value={String(form.status || 'draft')} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2"><Label>Excerpt</Label><Textarea value={String(form.excerpt || '')} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} /></div>
                    <div className="md:col-span-2"><Label>Content</Label><Textarea value={String(form.content || '')} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} /></div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Featured image</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !token) return;
                          setUploading(true);
                          try {
                            const result = await uploadContentImage(token, 'blog', file, form.featured_image || undefined);
                            setForm({ ...form, featured_image: result.imageUrl });
                            toast.success('Featured image uploaded');
                          } catch (err: any) {
                            toast.error(err?.response?.data?.message || 'Upload failed');
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                      {form.featured_image && <img src={form.featured_image} alt="Featured" className="max-h-40 rounded-md object-cover" />}
                    </div>
                    <div><Label>Tags (comma separated)</Label><Input value={Array.isArray(form.tags) ? form.tags.join(', ') : ''} onChange={(e) => handleArrayChange('tags', e.target.value)} /></div>
                    <div><Label>Categories (comma separated)</Label><Input value={Array.isArray(form.categories) ? form.categories.join(', ') : ''} onChange={(e) => handleArrayChange('categories', e.target.value)} /></div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <p><span className="text-muted-foreground">Slug:</span> /{post.slug}</p>
                    <p><span className="text-muted-foreground">Excerpt:</span> {post.excerpt || '—'}</p>
                    {post.featured_image && <img src={post.featured_image} alt={post.title} className="max-h-64 rounded-md object-cover" />}
                    <div className="prose max-w-none whitespace-pre-wrap">{post.content || '—'}</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(post.tags) && post.tags.map((t) => <Badge key={String(t)} variant="outline">{String(t)}</Badge>)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(post.categories) && post.categories.map((c) => <Badge key={String(c)} variant="secondary">{String(c)}</Badge>)}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-1 h-4 w-4" /> Delete post</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Meta title</Label><Input value={String(form.meta_title || '')} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} /></div>
                    <div><Label>Meta keywords</Label><Input value={String(form.meta_keywords || '')} onChange={(e) => setForm({ ...form, meta_keywords: e.target.value })} /></div>
                    <div className="md:col-span-2"><Label>Meta description</Label><Textarea value={String(form.meta_description || '')} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={3} /></div>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <p><span className="text-muted-foreground">Meta title:</span> {post.meta_title || '—'}</p>
                    <p><span className="text-muted-foreground">Meta keywords:</span> {post.meta_keywords || '—'}</p>
                    <p className="md:col-span-2"><span className="text-muted-foreground">Meta description:</span> {post.meta_description || '—'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Publication</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                {isEditing ? (
                  <>
                    <div><Label>Published at</Label><Input type="datetime-local" value={form.published_at ? formatDateTimeLocal(form.published_at) : ''} onChange={(e) => setForm({ ...form, published_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></div>
                    <div><Label>Scheduled at</Label><Input type="datetime-local" value={form.scheduled_at ? formatDateTimeLocal(form.scheduled_at) : ''} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.allow_comments} onChange={(e) => setForm({ ...form, allow_comments: e.target.checked })} /> Allow comments</label>
                    </div>
                  </>
                ) : (
                  <>
                    <p><span className="text-muted-foreground">Published:</span> {post.published_at ? formatDateTime(post.published_at) : '—'}</p>
                    <p><span className="text-muted-foreground">Scheduled:</span> {post.scheduled_at ? formatDateTime(post.scheduled_at) : '—'}</p>
                    <p><span className="text-muted-foreground">Featured:</span> {post.featured ? 'Yes' : 'No'}</p>
                    <p><span className="text-muted-foreground">Comments:</span> {post.allow_comments ? 'Allowed' : 'Disabled'}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Views:</span> {post.view_count ?? 0}</p>
                <p><span className="text-muted-foreground">Comments:</span> {post.comment_count ?? 0}</p>
                <p><span className="text-muted-foreground">Created:</span> {post.created_at ? formatDate(post.created_at) : '—'}</p>
                <p><span className="text-muted-foreground">Updated:</span> {post.updated_at ? formatDate(post.updated_at) : '—'}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function formatDateTimeLocal(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
