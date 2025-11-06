import { cn } from '@/lib/utils';

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
  onRollback: (oid: string) => void;
}

export function Timeline({ history, onRollback }: TimelineProps) {
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
    <div>
      {history.map((commit, index) => (
        <div key={commit.oid} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-foreground" />
            {index < history.length - 1 && (
              <div className="w-px h-full min-h-8 bg-border mt-1" />
            )}
          </div>
          <div className="flex-1 pb-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium">{commit.message.trim()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {commit.author.name} • {formatDate(commit.author.timestamp)} at{' '}
                {formatTime(commit.author.timestamp)} • {shortHash(commit.oid)}
              </div>
            </div>
            <button
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none",
                "h-8 min-w-8 px-1.5",
                "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
              onClick={() => onRollback(commit.oid)}
            >
              Rollback
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

