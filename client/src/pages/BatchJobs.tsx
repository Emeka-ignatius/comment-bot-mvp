import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function BatchJobs() {
  const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [selectedComments, setSelectedComments] = useState<number[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'delay' | 'spread'>('immediate');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [spreadMinutes, setSpreadMinutes] = useState(5);

  const videosQuery = trpc.videos.list.useQuery();
  const accountsQuery = trpc.accounts.list.useQuery();
  const commentsQuery = trpc.comments.list.useQuery();
  const batchCreateMutation = trpc.batch.create.useMutation();

  const videos = videosQuery.data || [];
  const accounts = accountsQuery.data || [];
  const comments = commentsQuery.data || [];

  const toggleVideo = (id: number) => {
    setSelectedVideos(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const toggleAccount = (id: number) => {
    setSelectedAccounts(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleComment = (id: number) => {
    setSelectedComments(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const totalJobs = selectedVideos.length * selectedAccounts.length * selectedComments.length;

  const handleCreateBatch = async () => {
    if (selectedVideos.length === 0 || selectedAccounts.length === 0 || selectedComments.length === 0) {
      toast.error('Please select at least one video, account, and comment template');
      return;
    }

    try {
      const result = await batchCreateMutation.mutateAsync({
        videoIds: selectedVideos,
        accountIds: selectedAccounts,
        commentTemplateIds: selectedComments,
        scheduleMode,
        delayMinutes: scheduleMode === 'delay' ? delayMinutes : undefined,
        spreadMinutes: scheduleMode === 'spread' ? spreadMinutes : undefined,
      });

      toast.success(`Created ${result.jobsCreated} jobs successfully!`);
      setSelectedVideos([]);
      setSelectedAccounts([]);
      setSelectedComments([]);
    } catch (error) {
      toast.error('Failed to create batch jobs');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Batch Job Creator</h1>
        <p className="text-gray-600 mt-2">Create multiple jobs at once with scheduling options</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Videos Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Videos</CardTitle>
            <CardDescription>{selectedVideos.length} selected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {videos.length === 0 ? (
              <p className="text-sm text-gray-500">No videos available</p>
            ) : (
              videos.map(video => (
                <div key={video.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`video-${video.id}`}
                    checked={selectedVideos.includes(video.id)}
                    onCheckedChange={() => toggleVideo(video.id)}
                  />
                  <Label htmlFor={`video-${video.id}`} className="cursor-pointer text-sm">
                    {video.videoUrl.substring(0, 40)}...
                  </Label>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Accounts Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>{selectedAccounts.length} selected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500">No accounts available</p>
            ) : (
              accounts.map(account => (
                <div key={account.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`account-${account.id}`}
                    checked={selectedAccounts.includes(account.id)}
                    onCheckedChange={() => toggleAccount(account.id)}
                  />
                  <Label htmlFor={`account-${account.id}`} className="cursor-pointer text-sm">
                    {account.accountName} ({account.platform})
                  </Label>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Comments Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
            <CardDescription>{selectedComments.length} selected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">No comment templates available</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`comment-${comment.id}`}
                    checked={selectedComments.includes(comment.id)}
                    onCheckedChange={() => toggleComment(comment.id)}
                  />
                  <Label htmlFor={`comment-${comment.id}`} className="cursor-pointer text-sm">
                    {comment.name}
                  </Label>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduling Options */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>Choose when jobs should be processed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={scheduleMode} onValueChange={(value: any) => setScheduleMode(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate" className="cursor-pointer">
                Immediate - Start all jobs right away
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="delay" id="delay" />
              <Label htmlFor="delay" className="cursor-pointer">
                Delay - Start all jobs after
              </Label>
              <Input
                type="number"
                min="1"
                value={delayMinutes}
                onChange={e => setDelayMinutes(parseInt(e.target.value) || 0)}
                className="w-20"
                disabled={scheduleMode !== 'delay'}
              />
              <span className="text-sm text-gray-600">minutes</span>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="spread" id="spread" />
              <Label htmlFor="spread" className="cursor-pointer">
                Spread - Distribute jobs every
              </Label>
              <Input
                type="number"
                min="1"
                value={spreadMinutes}
                onChange={e => setSpreadMinutes(parseInt(e.target.value) || 1)}
                className="w-20"
                disabled={scheduleMode !== 'spread'}
              />
              <span className="text-sm text-gray-600">minutes</span>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Job Preview */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Job Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-semibold">Total Jobs to Create:</span> <span className="text-2xl font-bold text-blue-600">{totalJobs}</span>
            </p>
            <p className="text-sm text-gray-600">
              {selectedVideos.length} video(s) × {selectedAccounts.length} account(s) × {selectedComments.length} comment(s)
            </p>
            {scheduleMode === 'spread' && totalJobs > 0 && (
              <p className="text-sm text-gray-600">
                Estimated completion: {Math.round((totalJobs - 1) * spreadMinutes)} minutes
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleCreateBatch}
          disabled={totalJobs === 0 || batchCreateMutation.isPending}
          className="flex-1"
        >
          {batchCreateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create {totalJobs} Jobs
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSelectedVideos([]);
            setSelectedAccounts([]);
            setSelectedComments([]);
          }}
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
