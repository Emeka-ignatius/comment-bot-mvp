import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  const { data: videos, isLoading: videosLoading } = trpc.videos.list.useQuery();
  const { data: jobs, isLoading: jobsLoading } = trpc.jobs.list.useQuery();
  const { data: logs, isLoading: logsLoading } = trpc.logs.list.useQuery();
  
  const testDirectAPI = trpc.test.directAPI.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Test comment posted successfully!');
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Test error: ${error.message}`);
    },
  });

  const stats = [
    { label: 'Total Accounts', value: accounts?.length || 0, icon: '🔐' },
    { label: 'Total Videos', value: videos?.length || 0, icon: '🎬' },
    { label: 'Total Jobs', value: jobs?.length || 0, icon: '⚙️' },
    { label: 'Total Logs', value: logs?.length || 0, icon: '📝' },
  ];

  const isLoading = accountsLoading || videosLoading || jobsLoading || logsLoading;

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <Button 
            onClick={() => {
              const firstAccount = accounts?.[0];
              const firstVideo = videos?.[0];
              if (!firstAccount || !firstVideo) {
                toast.error('Need at least one account and one video to test');
                return;
              }
              testDirectAPI.mutate({
                videoUrl: firstVideo.videoUrl,
                comment: 'Test comment from direct API',
                cookies: firstAccount.cookies || '',
              });
            }}
            disabled={testDirectAPI.isPending || !accounts?.length || !videos?.length}
          >
            {testDirectAPI.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
            ) : (
              '🧪 Test Direct API'
            )}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  {isLoading ? (
                    <Loader2 className="animate-spin mt-2" size={24} />
                  ) : (
                    <p className="text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                  )}
                </div>
                <span className="text-4xl">{stat.icon}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-accent rounded">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {log.status === 'success' ? '✅' : '❌'} {log.platform} - {log.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent activity</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}
