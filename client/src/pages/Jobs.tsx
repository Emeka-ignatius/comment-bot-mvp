import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Jobs() {
  const { data: jobs, isLoading, refetch } = trpc.jobs.list.useQuery();
  const { data: videos } = trpc.videos.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: comments } = trpc.comments.list.useQuery();

  const createMutation = trpc.jobs.create.useMutation();
  const deleteMutation = trpc.jobs.delete.useMutation();

  const [formData, setFormData] = useState({
    videoId: '',
    accountId: '',
    commentTemplateId: '',
  });

  const handleCreate = async () => {
    if (!formData.videoId || !formData.accountId || !formData.commentTemplateId) {
      toast.error('Please select all fields');
      return;
    }

    try {
      await createMutation.mutateAsync({
        videoId: parseInt(formData.videoId),
        accountId: parseInt(formData.accountId),
        commentTemplateId: parseInt(formData.commentTemplateId),
      });
      toast.success('Job created successfully');
      setFormData({ videoId: '', accountId: '', commentTemplateId: '' });
      refetch();
    } catch (error) {
      toast.error('Failed to create job');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Job deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Job Queue Management</h1>

        {/* Create Job Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Create New Job</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Select Video</label>
                <select
                  value={formData.videoId}
                  onChange={(e) => setFormData({ ...formData, videoId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="">-- Select a video --</option>
                  {videos?.map((video) => (
                    <option key={video.id} value={video.id}>
                      {video.title || `Video ${video.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Select Account</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="">-- Select an account --</option>
                  {accounts?.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Select Comment</label>
                <select
                  value={formData.commentTemplateId}
                  onChange={(e) => setFormData({ ...formData, commentTemplateId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="">-- Select a comment --</option>
                  {comments?.map((comment) => (
                    <option key={comment.id} value={comment.id}>
                      {comment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
              Create Job
            </Button>
          </div>
        </Card>

        {/* Jobs List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Job Queue</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 bg-accent rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      <p className="font-medium text-foreground">Job #{job.id}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created: {new Date(job.createdAt).toLocaleString()}
                    </p>
                    {job.errorMessage && (
                      <p className="text-xs text-red-600 mt-1">Error: {job.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-destructive rounded text-muted-foreground hover:text-destructive-foreground"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No jobs yet. Create one to get started.</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}
