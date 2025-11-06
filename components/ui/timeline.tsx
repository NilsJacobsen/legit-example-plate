'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  /** Array of commits from useLegitFile hook, ordered newest first */
  history: Commit[];
  /** Callback to rollback to a specific commit */
  onRollback: (oid: string) => void;
  /** Function from useLegitFile to retrieve content from a past commit */
  getPastState: (oid: string) => Promise<string | null>;
}

/**
 * Calculate character differences between two content strings.
 * Returns the number of characters added and deleted.
 */
function calculateDiff(oldContent: string, newContent: string): { added: number; deleted: number } {
  if (!oldContent) {
    return { added: newContent.length, deleted: 0 };
  }
  
  if (!newContent) {
    return { added: 0, deleted: oldContent.length };
  }
  
  // Normalize JSON content for comparison
  try {
    const oldStr = JSON.stringify(JSON.parse(oldContent));
    const newStr = JSON.stringify(JSON.parse(newContent));
    
    if (oldStr === newStr) {
      return { added: 0, deleted: 0 };
    }
    
    const lengthDiff = newStr.length - oldStr.length;
    
    if (lengthDiff > 0) {
      return { added: lengthDiff, deleted: 0 };
    } else if (lengthDiff < 0) {
      return { added: 0, deleted: Math.abs(lengthDiff) };
    } else {
      // Same length but different content
      const estimated = Math.ceil(Math.max(oldStr.length, newStr.length) * 0.1);
      return { added: estimated, deleted: estimated };
    }
  } catch {
    // Fallback to simple string comparison
    const lengthDiff = newContent.length - oldContent.length;
    if (lengthDiff > 0) {
      return { added: lengthDiff, deleted: 0 };
    } else if (lengthDiff < 0) {
      return { added: 0, deleted: Math.abs(lengthDiff) };
    } else {
      return { added: 0, deleted: 0 };
    }
  }
}

/**
 * Render a line-by-line diff between old and new content.
 * Lines prefixed with + are additions, - are deletions.
 */
function renderDiff(oldContent: string, newContent: string): string {
  if (!oldContent) return newContent;
  if (!newContent) return '';
  
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];
  
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === newLine) {
      diff.push(` ${newLine || ''}`);
    } else {
      if (oldLine) diff.push(`-${oldLine}`);
      if (newLine) diff.push(`+${newLine}`);
    }
  }
  
  return diff.join('\n');
}

export function Timeline({ history, onRollback, getPastState }: TimelineProps) {
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [commitContents, setCommitContents] = useState<Record<string, string>>({});
  const [commitDiffs, setCommitDiffs] = useState<Record<string, { added: number; deleted: number }>>({});

  // Load commit contents and calculate diffs when history changes
  useEffect(() => {
    const loadCommitData = async () => {
      const contents: Record<string, string> = {};
      const diffs: Record<string, { added: number; deleted: number }> = {};
      
      // Load all commit contents first (oldest to newest)
      // History array is ordered newest first (index 0 = newest commit)
      for (let i = history.length - 1; i >= 0; i--) {
        const commit = history[i];
        const content = await getPastState(commit.oid);
        if (content) {
          contents[commit.oid] = content;
        }
      }
      
      // Calculate diffs: compare each commit with the previous one (older commit)
      for (let i = 0; i < history.length; i++) {
        const commit = history[i];
        const content = contents[commit.oid];
        
        if (!content) continue;
        
        // Compare with previous commit (at index i+1, which is older)
        if (i < history.length - 1) {
          const prevCommit = history[i + 1];
          const prevContent = contents[prevCommit.oid];
          if (prevContent) {
            diffs[commit.oid] = calculateDiff(prevContent, content);
          } else {
            diffs[commit.oid] = { added: content.length, deleted: 0 };
          }
        } else {
          // Oldest commit - all content is new
          diffs[commit.oid] = { added: content.length, deleted: 0 };
        }
      }
      
      setCommitContents(contents);
      setCommitDiffs(diffs);
    };
    
    loadCommitData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const toggleCommit = (commitOid: string) => {
    setExpandedCommits(prev => {
      const next = new Set(prev);
      if (next.has(commitOid)) {
        next.delete(commitOid);
      } else {
        next.add(commitOid);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortHash = (oid: string) => oid.substring(0, 7);

  return (
    <div className="space-y-2">
      {history.map((commit, index) => {
        const isExpanded = expandedCommits.has(commit.oid);
        const content = commitContents[commit.oid];
        const diff = commitDiffs[commit.oid];
        const prevCommit = index < history.length - 1 ? history[index + 1] : null;
        const prevContent = prevCommit ? commitContents[prevCommit.oid] : null;
        
        return (
          <div key={commit.oid} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-foreground shrink-0 mt-1.5" />
              {index < history.length - 1 && (
                <div className="w-px flex-1 min-h-4 bg-border mt-1" />
              )}
            </div>
            
            {/* Commit content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{commit.message.trim()}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      {commit.author.name} • {formatDate(commit.author.timestamp)} at{' '}
                      {formatTime(commit.author.timestamp)} • {shortHash(commit.oid)}
                    </span>
                    {diff && (
                      <span className="flex items-center gap-2 ml-2">
                        {diff.added > 0 && (
                          <span className="text-green-600 dark:text-green-400">+{diff.added}</span>
                        )}
                        {diff.deleted > 0 && (
                          <span className="text-red-600 dark:text-red-400">-{diff.deleted}</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className={cn(
                      "inline-flex items-center justify-center rounded-md text-sm font-medium",
                      "h-8 px-1.5 border border-input bg-transparent",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "transition-colors"
                    )}
                    onClick={() => onRollback(commit.oid)}
                  >
                    Rollback
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center rounded-md text-sm",
                      "h-8 w-8 p-0 border border-transparent bg-transparent",
                      "hover:bg-accent/60 hover:text-accent-foreground",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "transition-colors"
                    )}
                    onClick={() => toggleCommit(commit.oid)}
                    aria-label={isExpanded ? "Collapse diff" : "Expand diff"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Diff view */}
              {isExpanded && content && (
                <div className="mt-3 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  <div className="whitespace-pre-wrap">
                    {prevContent ? (
                      renderDiff(prevContent, content).split('\n').map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            line.startsWith('+') && 'text-green-600 dark:text-green-400',
                            line.startsWith('-') && 'text-red-600 dark:text-red-400',
                            !line.startsWith('+') && !line.startsWith('-') && 'text-muted-foreground'
                          )}
                        >
                          {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-green-600 dark:text-green-400">
                        {content.split('\n').map((line, i) => (
                          <div key={i}>+{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

