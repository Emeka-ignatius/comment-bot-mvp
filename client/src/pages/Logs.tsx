import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';

export default function Logs() {
  const { data: logs, isLoading } = trpc.logs.list.useQuery();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭️';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'skipped':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Submission Logs</h1>

        {/* Logs List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">All Submissions</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-4 bg-accent rounded border border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-lg ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)}
                        </span>
                        <span className="font-medium text-foreground capitalize">{log.status}</span>
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {log.platform === 'youtube' ? '🎬 YouTube' : '🎥 Rumble'}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-1">{log.message}</p>
                      {log.errorDetails && (
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2 font-mono">
                          {log.errorDetails}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Job ID: {log.jobId} • {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No logs yet. Submit a job to see logs here.</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}
