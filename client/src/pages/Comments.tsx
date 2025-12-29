import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Comments() {
  const { data: comments, isLoading, refetch } = trpc.comments.list.useQuery();
  const createMutation = trpc.comments.create.useMutation();
  const deleteMutation = trpc.comments.delete.useMutation();

  const [formData, setFormData] = useState({
    name: '',
    content: '',
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.content) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await createMutation.mutateAsync(formData);
      toast.success('Comment template created successfully');
      setFormData({ name: '', content: '' });
      refetch();
    } catch (error) {
      toast.error('Failed to create comment template');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment template?')) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Comment template deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete comment template');
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Comment Pool Management</h1>

        {/* Create Comment Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Add New Comment Template</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Template Name</label>
              <Input
                type="text"
                placeholder="e.g., Positive Feedback"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Comment Content</label>
              <textarea
                placeholder="Enter the comment text..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground h-24"
              />
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
              Add Comment Template
            </Button>
          </div>
        </Card>

        {/* Comments List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Comment Templates</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start justify-between p-4 bg-accent rounded">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{comment.name}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{comment.content}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-destructive rounded text-muted-foreground hover:text-destructive-foreground ml-4"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No comment templates yet. Add one to get started.</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}
