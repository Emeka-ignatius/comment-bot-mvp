import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, Plus, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Videos() {
  const { data: videos, isLoading, refetch } = trpc.videos.list.useQuery();
  const createMutation = trpc.videos.create.useMutation();
  const deleteMutation = trpc.videos.delete.useMutation();
  const reExtractMutation = trpc.videos.reExtractChatId.useMutation();

  const [formData, setFormData] = useState({
    platform: 'youtube' as 'youtube' | 'rumble',
    videoUrl: '',
    videoId: '',
    title: '',
  });

  const [urlError, setUrlError] = useState<string>('');
  const [chatIdVerification, setChatIdVerification] = useState<{
    show: boolean;
    chatId: string | null;
    loading: boolean;
  }>({
    show: false,
    chatId: null,
    loading: false,
  });
  const [pendingFormData, setPendingFormData] = useState<typeof formData | null>(null);

  const extractVideoId = (url: string) => {
    let videoId = '';
    let platform = 'youtube' as 'youtube' | 'rumble';
    let error = '';

    if (!url.trim()) {
      return { videoId: '', platform, error: '' };
    }

    try {
      new URL(url);

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let match = url.match(/v=([^&]+)/);
        if (!match) {
          match = url.match(/youtu\.be\/([^?&]+)/);
        }
        if (match) {
          videoId = match[1];
          platform = 'youtube';
        } else {
          error = 'Invalid YouTube URL. Please use format: https://www.youtube.com/watch?v=VIDEO_ID';
        }
      } else if (url.includes('rumble.com')) {
        const match = url.match(/\/v([0-9a-z]+)/i);
        if (match) {
          videoId = match[1];
          platform = 'rumble';
        } else {
          error = 'Invalid Rumble URL. Please use format: https://rumble.com/v[VIDEO_ID]-[title].html';
        }
      } else {
        error = 'Unsupported platform. Please use YouTube or Rumble URLs.';
      }
    } catch (e) {
      error = 'Invalid URL format. Please enter a valid video URL.';
    }

    return { videoId, platform, error };
  };

  const handleUrlChange = (url: string) => {
    const { videoId, platform, error } = extractVideoId(url);
    setUrlError(error);
    setFormData({ ...formData, videoUrl: url, videoId, platform });
  };

  const handleCreate = async () => {
    if (!formData.videoUrl) {
      toast.error('Please enter a video URL');
      return;
    }

    if (!formData.videoId) {
      toast.error(urlError || 'Please provide a valid video URL');
      return;
    }

    if (formData.platform === 'rumble') {
      setPendingFormData(formData);
      setChatIdVerification({ show: true, chatId: null, loading: true });

      setTimeout(() => {
        setChatIdVerification({
          show: true,
          chatId: 'Extracting from server...',
          loading: false,
        });
      }, 500);
      return;
    }

    await createVideoDirectly(formData);
  };

  const createVideoDirectly = async (data: typeof formData) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Video added successfully');
      setFormData({ platform: 'youtube', videoUrl: '', videoId: '', title: '' });
      setUrlError('');
      setChatIdVerification({ show: false, chatId: null, loading: false });
      refetch();
    } catch (error) {
      toast.error('Failed to add video');
    }
  };

  const handleConfirmChatId = async () => {
    if (pendingFormData) {
      await createVideoDirectly(pendingFormData);
      setPendingFormData(null);
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

  const handleReExtract = async (id: number) => {
    try {
      toast.info('Re-extracting chat ID...');
      const result = await reExtractMutation.mutateAsync({ id });
      toast.success(`Successfully extracted chat ID: ${result.chatId}`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to re-extract chat ID');
    }
  };

  return (
    <AdminDashboardLayout>
      <Dialog
        open={chatIdVerification.show}
        onOpenChange={(open) => {
          if (!open) {
            setChatIdVerification({ show: false, chatId: null, loading: false });
            setPendingFormData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Chat ID</DialogTitle>
            <DialogDescription>
              Please verify the extracted chat ID before saving the video
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-2">Extracted Chat ID:</p>
              <div className="flex items-center gap-2">
                {chatIdVerification.loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-lg font-mono text-foreground">Extracting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="text-green-500" size={20} />
                    <span className="text-lg font-mono text-foreground font-semibold">
                      {chatIdVerification.chatId || 'N/A'}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This ID will be used to post comments on the stream
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                ℹ️ Make sure this chat ID looks correct (should be a 6+ digit number, not a video slug like v742hom)
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setChatIdVerification({ show: false, chatId: null, loading: false })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmChatId} disabled={chatIdVerification.loading}>
              {chatIdVerification.loading ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : null}
              Confirm & Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Video Management</h1>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Add New Video</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Platform
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      platform: e.target.value as 'youtube' | 'rumble',
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="youtube">YouTube</option>
                  <option value="rumble">Rumble</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Video Title (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Video Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Video URL
              </label>
              <Input
                type="text"
                placeholder={
                  formData.platform === 'youtube'
                    ? 'https://www.youtube.com/watch?v=...'
                    : 'https://rumble.com/v...'
                }
                value={formData.videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={urlError ? 'border-red-500' : ''}
              />
              {urlError && (
                <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 rounded border border-red-200">
                  <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{urlError}</p>
                </div>
              )}
              {formData.videoId && !urlError && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ Video ID detected: {formData.videoId}
                </p>
              )}
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.videoId}
              className="w-full"
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <Plus size={16} className="mr-2" />
              )}
              Add Video
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Your Videos</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="space-y-3">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-4 bg-accent rounded"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{video.title || 'Untitled'}</p>
                    <p className="text-sm text-muted-foreground">
                      {video.platform === 'youtube' ? '🎬 YouTube' : '🎥 Rumble'} • {video.videoId}
                    </p>
                    {video.chatId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Chat ID: <span className="font-mono">{video.chatId}</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: <span className="capitalize">{video.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {video.platform === 'rumble' && (
                      <button
                        onClick={() => handleReExtract(video.id)}
                        disabled={reExtractMutation.isPending}
                        title="Re-extract Chat ID"
                        className="p-2 hover:bg-primary/10 rounded text-muted-foreground hover:text-primary"
                      >
                        {reExtractMutation.isPending && reExtractMutation.variables?.id === video.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <RefreshCw size={18} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(video.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete Video"
                      className="p-2 hover:bg-destructive rounded text-muted-foreground hover:text-destructive-foreground"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
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
