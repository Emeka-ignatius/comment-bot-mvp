import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Videos() {
  const { data: videos, isLoading, refetch } = trpc.videos.list.useQuery();
  const createMutation = trpc.videos.create.useMutation();
  const deleteMutation = trpc.videos.delete.useMutation();

  const [formData, setFormData] = useState({
    platform: 'youtube' as 'youtube' | 'rumble',
    videoUrl: '',
    videoId: '',
    title: '',
  });

  const extractVideoId = (url: string) => {
    let videoId = '';
    if (url.includes('youtube.com')) {
      const match = url.match(/v=([^&]+)/);
      videoId = match ? match[1] : '';
    } else if (url.includes('rumble.com')) {
      const match = url.match(/\/v\/([^/?]+)/);
      videoId = match ? match[1] : '';
    }
    return videoId;
  };

  const handleUrlChange = (url: string) => {
    const videoId = extractVideoId(url);
    setFormData({ ...formData, videoUrl: url, videoId });
  };

  const handleCreate = async () => {
    if (!formData.videoUrl || !formData.videoId) {
      toast.error('Please provide a valid video URL');
      return;
    }

    try {
      await createMutation.mutateAsync(formData);
      toast.success('Video added successfully');
      setFormData({ platform: 'youtube', videoUrl: '', videoId: '', title: '' });
      refetch();
    } catch (error) {
      toast.error('Failed to add video');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Video deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete video');
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Video Management</h1>

        {/* Add Video Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Add New Video</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'youtube' | 'rumble' })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="youtube">YouTube</option>
                  <option value="rumble">Rumble</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Video Title (Optional)</label>
                <Input
                  type="text"
                  placeholder="Video Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Video URL</label>
              <Input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={formData.videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
              Add Video
            </Button>
          </div>
        </Card>

        {/* Videos List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Your Videos</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="space-y-3">
              {videos.map((video) => (
                <div key={video.id} className="flex items-center justify-between p-4 bg-accent rounded">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{video.title || 'Untitled'}</p>
                    <p className="text-sm text-muted-foreground">
                      {video.platform === 'youtube' ? '🎬 YouTube' : '🎥 Rumble'} • {video.videoId}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: <span className="capitalize">{video.status}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(video.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-destructive rounded text-muted-foreground hover:text-destructive-foreground"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No videos yet. Add one to get started.</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}
