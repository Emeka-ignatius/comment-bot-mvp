import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Pause, Square, Sparkles, Eye, MessageSquare, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

type CommentStyle = 'engaging' | 'supportive' | 'curious' | 'casual' | 'professional' | 'hype' | 'question' | 'agreement';

interface MonitorSession {
  id: string;
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  commentsPosted: number;
  lastComment?: string;
  lastCommentTime?: Date;
  errors: string[];
  startupStage?: string;
  startupMessage?: string;
  startupStartedAtMs?: number;
  startupUpdatedAtMs?: number;
}

export default function AIAutoComment() {
  // Form state
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [commentStyle, setCommentStyle] = useState<CommentStyle>('engaging');
  const [commentInterval, setCommentInterval] = useState(60); // seconds
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [maxCommentLength, setMaxCommentLength] = useState(150);
  const [audioEnabled, setAudioEnabled] = useState(true); // Enable audio transcription by default
  const [audioInterval, setAudioInterval] = useState(90); // Capture audio every 90 seconds (lower proxy/CDN bandwidth)
  
  // Preview state
  const [previewComment, setPreviewComment] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Data queries
  const { data: videos, isLoading: videosLoading } = trpc.videos.list.useQuery();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  const { data: sessions, refetch: refetchSessions } = trpc.aiComment.listSessions.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  // Mutations
  const startMonitor = trpc.aiComment.startMonitor.useMutation({
    onSuccess: () => {
      toast.success('AI monitoring starting…');
      refetchSessions();
    },
    onError: (err) => toast.error(err.message),
  });

  const formatElapsed = (startedAtMs?: number) => {
    if (!startedAtMs) return null;
    const s = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };
  
  const stopMonitor = trpc.aiComment.stopMonitor.useMutation({
    onSuccess: () => {
      toast.success('Monitoring stopped');
      refetchSessions();
    },
    onError: (err) => toast.error(err.message),
  });

  // Same stop endpoint, but without per-session toast (useful for "Stop all").
  const stopMonitorSilent = trpc.aiComment.stopMonitor.useMutation({
    onSuccess: () => {
      refetchSessions();
    },
  });

  const [stopAllPending, setStopAllPending] = useState(false);
  
  const pauseMonitor = trpc.aiComment.pauseMonitor.useMutation({
    onSuccess: () => {
      toast.success('Monitoring paused');
      refetchSessions();
    },
    onError: (err) => toast.error(err.message),
  });
  
  const resumeMonitor = trpc.aiComment.resumeMonitor.useMutation({
    onSuccess: () => {
      toast.success('Monitoring resumed');
      refetchSessions();
    },
    onError: (err) => toast.error(err.message),
  });
  
  const previewMutation = trpc.aiComment.preview.useMutation({
    onSuccess: (data) => {
      setPreviewComment(data.comment);
      setPreviewLoading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setPreviewLoading(false);
    },
  });
  
  // Filter accounts by platform of selected video
  const selectedVideo = videos?.find(v => v.id === selectedVideoId);
  const filteredAccounts = accounts?.filter(a => 
    selectedVideo ? a.platform === selectedVideo.platform : true
  ) || [];

  const selectableAccountIds = filteredAccounts.filter(a => a.isActive).map(a => a.id);
  const allSelectableSelected =
    selectableAccountIds.length > 0 &&
    selectableAccountIds.every(id => selectedAccountIds.includes(id));
  
  // Handle account selection toggle
  const toggleAccount = (accountId: number) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const selectAllActiveAccounts = () => {
    setSelectedAccountIds(selectableAccountIds);
  };

  const clearSelectedAccounts = () => {
    setSelectedAccountIds([]);
  };
  
  // Handle preview
  const handlePreview = () => {
    if (!selectedVideoId) {
      toast.error('Please select a video first');
      return;
    }
    setPreviewLoading(true);
    previewMutation.mutate({
      videoId: selectedVideoId,
      style: commentStyle,
      includeEmojis,
      maxLength: maxCommentLength,
    });
  };
  
  // Handle start monitoring
  const handleStart = () => {
    if (!selectedVideoId) {
      toast.error('Please select a video');
      return;
    }
    if (selectedAccountIds.length === 0) {
      toast.error('Please select at least one account');
      return;
    }
    
    startMonitor.mutate({
      videoId: selectedVideoId,
      commentStyle,
      commentInterval,
      includeEmojis,
      maxCommentLength,
      accountIds: selectedAccountIds,
      audioEnabled,
      audioInterval,
    });
  };

  const handleStopAll = async () => {
    if (!sessions || sessions.length === 0) return;
    setStopAllPending(true);
    try {
      for (const s of sessions) {
        await stopMonitorSilent.mutateAsync({ sessionId: s.id });
      }
      toast.success('All monitoring stopped');
      refetchSessions();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to stop all monitoring');
    } finally {
      setStopAllPending(false);
    }
  };
  
  const styleDescriptions: Record<CommentStyle, string> = {
    engaging: 'Enthusiastic reactions, questions, and genuine interest',
    supportive: 'Positive, encouraging, and community-building',
    curious: 'Thoughtful questions about the content',
    casual: 'Relaxed, conversational, like chatting with friends',
    professional: 'Informative and respectful, adds value',
    hype: 'High energy, excited vibes with lots of emojis',
    question: 'Thought-provoking questions to engage viewers',
    agreement: 'Validation and consensus with the stream content',
  };
  


  return (
    <AdminDashboardLayout>
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">AI Auto-Comment</h1>
        <p className="text-muted-foreground">
          Automatically generate and post contextual comments on live streams using AI
        </p>
      </div>
      
      {/* Active Sessions */}
      {sessions && sessions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Active Monitoring Sessions
              </CardTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopAll}
                disabled={stopAllPending || stopMonitorSilent.isPending}
                title="Stop all monitoring sessions"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessions.map((session: MonitorSession) => (
              <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      session.status === 'running' ? 'default' :
                      session.status === 'paused' ? 'secondary' :
                      session.status === 'error' ? 'destructive' : 'outline'
                    }>
                      {session.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {session.commentsPosted} comments posted
                    </span>
                  </div>
                  {session.status === 'starting' && (
                    <p className="text-sm text-muted-foreground">
                      {session.startupMessage ?? 'Starting…'}
                      {formatElapsed(session.startupStartedAtMs) ? (
                        <span className="ml-2 text-xs">
                          ({formatElapsed(session.startupStartedAtMs)})
                        </span>
                      ) : null}
                    </p>
                  )}
                  {session.lastComment && (
                    <p className="text-sm text-muted-foreground italic">
                      Last: "{session.lastComment.slice(0, 50)}..."
                    </p>
                  )}
                  {session.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {session.errors[session.errors.length - 1]}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {session.status === 'running' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pauseMonitor.mutate({ sessionId: session.id })}
                      disabled={pauseMonitor.isPending}
                      title="Pause monitoring"
                      className="flex items-center gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  {session.status === 'paused' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resumeMonitor.mutate({ sessionId: session.id })}
                      disabled={resumeMonitor.isPending}
                      title="Resume monitoring"
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => stopMonitor.mutate({ sessionId: session.id })}
                    disabled={stopMonitor.isPending}
                    title="Stop monitoring"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set up AI comment generation for a live stream</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Video Selection */}
            <div className="space-y-2">
              <Label>Select Video/Stream</Label>
              <Select
                value={selectedVideoId?.toString() || ''}
                onValueChange={(v) => {
                  setSelectedVideoId(Number(v));
                  setSelectedAccountIds([]); // Reset accounts when video changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a video..." />
                </SelectTrigger>
                <SelectContent>
                  {videosLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : videos?.length === 0 ? (
                    <SelectItem value="none" disabled>No videos added yet</SelectItem>
                  ) : (
                    videos?.map((video) => (
                      <SelectItem key={video.id} value={video.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {video.platform}
                          </Badge>
                          {video.title || video.videoUrl.slice(0, 40)}
                          {!video.chatId && (
                            <Badge variant="destructive" className="text-xs">No Chat ID</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedVideo && !selectedVideo.chatId && (
                <p className="text-sm text-destructive">
                  This video doesn't have a chat ID. Please re-add it to extract the chat ID.
                </p>
              )}
            </div>
            
            {/* Comment Style */}
            <div className="space-y-2">
              <Label>Comment Style</Label>
              <Select
                value={commentStyle}
                onValueChange={(v) => setCommentStyle(v as CommentStyle)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['engaging', 'supportive', 'curious', 'casual', 'professional', 'hype', 'question', 'agreement'] as CommentStyle[]).map((style) => (
                    <SelectItem key={style} value={style}>
                      <span className="capitalize">{style}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {styleDescriptions[commentStyle]}
              </p>
            </div>
            
            {/* Comment Interval */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Comment Interval
                </Label>
                <span className="text-sm text-muted-foreground">
                  {commentInterval < 60 
                    ? `${commentInterval} seconds`
                    : `${Math.floor(commentInterval / 60)} min ${commentInterval % 60 > 0 ? `${commentInterval % 60}s` : ''}`
                  }
                </span>
              </div>
              <Slider
                value={[commentInterval]}
                onValueChange={([v]) => setCommentInterval(v)}
                min={10}
                max={300}
                step={5}
              />
              <p className="text-sm text-muted-foreground">
                Time between AI-generated comments
              </p>
            </div>
            
            {/* Max Comment Length */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Max Comment Length
                </Label>
                <span className="text-sm text-muted-foreground">
                  {maxCommentLength} characters
                </span>
              </div>
              <Slider
                value={[maxCommentLength]}
                onValueChange={([v]) => setMaxCommentLength(v)}
                min={3}
                max={300}
                step={1}
              />
            </div>
            
            {/* Include Emojis */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Emojis</Label>
                <p className="text-sm text-muted-foreground">
                  Add natural emojis to comments
                </p>
              </div>
              <Switch
                checked={includeEmojis}
                onCheckedChange={setIncludeEmojis}
              />
            </div>
            
            {/* Audio Transcription */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Audio Transcription
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Capture and transcribe stream audio for richer context
                  </p>
                </div>
                <Switch
                  checked={audioEnabled}
                  onCheckedChange={setAudioEnabled}
                />
              </div>
              
              {audioEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Audio Capture Interval</Label>
                    <span className="text-sm text-muted-foreground">
                      {audioInterval < 60 
                        ? `${audioInterval} seconds`
                        : `${Math.floor(audioInterval / 60)} min`
                      }
                    </span>
                  </div>
                  <Slider
                    value={[audioInterval]}
                    onValueChange={([v]) => setAudioInterval(v)}
                    min={15}
                    max={120}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to capture and transcribe audio from the stream
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Account Selection & Preview */}
        <div className="space-y-6">
          {/* Account Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Accounts
              </CardTitle>
              <CardDescription>
                Choose accounts to rotate for posting comments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  {selectedVideo 
                    ? `No ${selectedVideo.platform} accounts available. Add one first.`
                    : 'Select a video to see available accounts.'
                  }
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 pb-2">
                    <div className="text-xs text-muted-foreground">
                      Selected {selectedAccountIds.length} / {selectableAccountIds.length} active
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={allSelectableSelected ? clearSelectedAccounts : selectAllActiveAccounts}
                      >
                        {allSelectableSelected ? "Clear" : "Select all active"}
                      </Button>
                    </div>
                  </div>
                  {filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedAccountIds.includes(account.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleAccount(account.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          account.isActive ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium">{account.accountName}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {account.platform}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview Comment
              </CardTitle>
              <CardDescription>
                Generate a sample comment to see how AI will respond
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePreview}
                disabled={previewLoading || !selectedVideoId}
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Preview
                  </>
                )}
              </Button>
              
              {previewComment && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Generated Comment:</p>
                  <p className="text-sm">{previewComment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Start Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={handleStart}
            disabled={
              startMonitor.isPending || 
              !selectedVideoId || 
              selectedAccountIds.length === 0 ||
              !selectedVideo?.chatId
            }
          >
            {startMonitor.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Start AI Monitoring
              </>
            )}
          </Button>
          {!selectedVideo?.chatId && selectedVideoId && (
            <p className="text-sm text-destructive text-center mt-2">
              Cannot start: Video is missing chat ID
            </p>
          )}
        </CardContent>
      </Card>
    </div>
    </AdminDashboardLayout>
  );
}
