interface Commit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset?: number;
  };
}

interface TimelineProps {
  history: Commit[];
}

export function Timeline({ history }: TimelineProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortHash = (oid: string) => oid.substring(0, 7);

  return (
    <div className="space-y-4">
      {history.map((commit, index) => (
        <div key={commit.oid} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-foreground" />
            {index < history.length - 1 && (
              <div className="w-px h-full min-h-8 bg-border mt-1" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="text-sm font-medium">{commit.message.trim()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {commit.author.name} • {formatDate(commit.author.timestamp)} at{' '}
              {formatTime(commit.author.timestamp)} • {shortHash(commit.oid)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

