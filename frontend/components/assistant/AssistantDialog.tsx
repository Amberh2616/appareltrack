'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  ListTodo,
  HelpCircle,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory,
  type ChatMessage,
  type ChatResponse,
} from '@/lib/api/assistant';

interface AssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Quick command buttons
const QUICK_COMMANDS = [
  { cmd: 'overdue', icon: AlertCircle, label: 'Overdue' },
  { cmd: 'this week', icon: Clock, label: 'This Week' },
  { cmd: 'tasks', icon: ListTodo, label: 'Tasks' },
  { cmd: 'summary', icon: FileText, label: 'Summary' },
  { cmd: 'help', icon: HelpCircle, label: 'Help' },
];

export function AssistantDialog({ open, onOpenChange }: AssistantDialogProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local state for messages (optimistic updates)
  const [localMessages, setLocalMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; response?: ChatResponse }>
  >([]);

  // Fetch chat history
  const { data: history } = useQuery({
    queryKey: ['assistant-chat-history'],
    queryFn: () => getChatHistory(50),
    enabled: open,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: sendChatMessage,
    onMutate: (message) => {
      // Optimistic update - add user message immediately
      setLocalMessages((prev) => [...prev, { role: 'user', content: message }]);
    },
    onSuccess: (data) => {
      // Add assistant response
      setLocalMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message, response: data },
      ]);
      queryClient.invalidateQueries({ queryKey: ['assistant-chat-history'] });
    },
    onError: () => {
      // Remove optimistic message on error
      setLocalMessages((prev) => prev.slice(0, -1));
    },
  });

  // Clear history mutation
  const clearMutation = useMutation({
    mutationFn: clearChatHistory,
    onSuccess: () => {
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ['assistant-chat-history'] });
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset local messages when dialog opens (to sync with server)
  useEffect(() => {
    if (open) {
      setLocalMessages([]);
    }
  }, [open]);

  const handleSend = () => {
    const message = input.trim();
    if (!message || sendMutation.isPending) return;

    setInput('');
    sendMutation.mutate(message);
  };

  const handleQuickCommand = (cmd: string) => {
    if (sendMutation.isPending) return;
    sendMutation.mutate(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Combine history with local messages
  const allMessages = [
    ...(history || []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    ...localMessages,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[700px] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Production Assistant</span>
          </DialogTitle>
        </DialogHeader>

        {/* Quick Commands */}
        <div className="px-4 py-2 border-b bg-gray-50 flex gap-2 overflow-x-auto">
          {QUICK_COMMANDS.map((qc) => (
            <Button
              key={qc.cmd}
              variant="outline"
              size="sm"
              className="shrink-0 h-7 text-xs"
              onClick={() => handleQuickCommand(qc.cmd)}
              disabled={sendMutation.isPending}
            >
              <qc.icon className="w-3 h-3 mr-1" />
              {qc.label}
            </Button>
          ))}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {/* Welcome message if no history */}
            {allMessages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                <p className="font-medium">Hi! I'm your Production Assistant</p>
                <p className="text-sm mt-1">
                  Try typing "help" to see what I can do!
                </p>
              </div>
            )}

            {/* Message bubbles */}
            {allMessages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}

            {/* Loading indicator */}
            {sendMutation.isPending && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or question..."
              disabled={sendMutation.isPending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-400">
              Press Enter to send
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-gray-400 hover:text-red-500"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Message bubble component
interface MessageBubbleProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    response?: ChatResponse;
  };
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {/* Main message */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Response data (for assistant messages) */}
        {message.response && <ResponseContent response={message.response} />}
      </div>
    </div>
  );
}

// Response content renderer
function ResponseContent({ response }: { response: ChatResponse }) {
  // Help commands
  if (response.type === 'help' && response.commands) {
    return (
      <div className="mt-2 space-y-1">
        {response.commands.map((cmd) => (
          <div key={cmd.cmd} className="flex items-start gap-2 text-xs">
            <code className="bg-gray-200 px-1 rounded font-mono">
              {cmd.cmd}
            </code>
            <span className="text-gray-600">{cmd.desc}</span>
          </div>
        ))}
      </div>
    );
  }

  // Items list (overdue, this week, tasks, etc.)
  if (response.items && response.items.length > 0) {
    return (
      <div className="mt-2 space-y-1">
        {response.items.slice(0, 5).map((item, idx) => (
          <ItemCard key={idx} item={item} type={response.type} />
        ))}
        {response.items.length > 5 && (
          <p className="text-xs text-gray-500 mt-1">
            +{response.items.length - 5} more...
          </p>
        )}
      </div>
    );
  }

  // Summary stats
  if (response.type === 'summary' && response.stats) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <StatCard label="Active Runs" value={response.stats.active_runs} />
        <StatCard label="Overdue" value={response.stats.overdue} color="red" />
        <StatCard label="Pending POs" value={response.stats.pending_pos} />
        <StatCard label="Tasks" value={response.stats.tasks} />
      </div>
    );
  }

  // Email draft
  if (response.type === 'draft_email' && response.email_draft) {
    return (
      <div className="mt-2 p-2 bg-white rounded border text-xs">
        <div className="flex items-center gap-1 text-gray-500 mb-1">
          <Mail className="w-3 h-3" />
          <span>To: {response.email_draft.to}</span>
        </div>
        <div className="font-medium mb-1">{response.email_draft.subject}</div>
        <pre className="text-gray-600 whitespace-pre-wrap text-xs">
          {response.email_draft.body}
        </pre>
      </div>
    );
  }

  // Success message
  if (response.success !== undefined) {
    return (
      <div className="mt-1 flex items-center gap-1">
        {response.success ? (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        ) : (
          <AlertCircle className="w-3 h-3 text-red-500" />
        )}
      </div>
    );
  }

  return null;
}

// Item card for lists
function ItemCard({ item, type }: { item: any; type: string }) {
  // Style info
  if (type === 'check_style') {
    return (
      <div className="p-2 bg-white rounded border text-xs">
        <div className="font-medium">{item.style_number}</div>
        <div className="text-gray-500">{item.style_name}</div>
        {item.runs && item.runs.length > 0 && (
          <div className="mt-1 space-y-1">
            {item.runs.map((run: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs h-5">
                  Run #{run.run_no}
                </Badge>
                <span className="text-gray-600">{run.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Overdue / This week items
  if (type === 'overdue' || type === 'this_week') {
    return (
      <div className="flex items-center justify-between p-2 bg-white rounded border text-xs">
        <div>
          <span className="font-medium">{item.style_number}</span>
          <span className="text-gray-500 ml-1">Run #{item.run_no}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.days_overdue && (
            <Badge variant="destructive" className="text-xs h-5">
              {item.days_overdue}d late
            </Badge>
          )}
          <Badge variant="outline" className="text-xs h-5">
            {item.status}
          </Badge>
        </div>
      </div>
    );
  }

  // Tasks
  if (type === 'tasks') {
    return (
      <div className="flex items-center justify-between p-2 bg-white rounded border text-xs">
        <span className="font-medium">{item.title}</span>
        <div className="flex items-center gap-1">
          <Badge
            variant={
              item.priority === 'high'
                ? 'destructive'
                : item.priority === 'medium'
                ? 'default'
                : 'secondary'
            }
            className="text-xs h-5"
          >
            {item.priority}
          </Badge>
        </div>
      </div>
    );
  }

  // POs
  if (type === 'pending_po') {
    return (
      <div className="flex items-center justify-between p-2 bg-white rounded border text-xs">
        <div>
          <span className="font-medium">{item.po_number}</span>
          <span className="text-gray-500 ml-1">{item.supplier}</span>
        </div>
        <Badge variant="outline" className="text-xs h-5">
          {item.status}
        </Badge>
      </div>
    );
  }

  // Recent
  if (type === 'recent') {
    return (
      <div className="flex items-center justify-between p-2 bg-white rounded border text-xs">
        <div>
          <span className="font-medium">{item.style_number}</span>
          <span className="text-gray-500 ml-1">Run #{item.run_no}</span>
        </div>
        <span className="text-gray-400 text-xs">{item.updated_at}</span>
      </div>
    );
  }

  // Default
  return (
    <div className="p-2 bg-white rounded border text-xs">
      {JSON.stringify(item)}
    </div>
  );
}

// Stat card for summary
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="p-2 bg-white rounded border text-center">
      <div
        className={`text-lg font-bold ${
          color === 'red' ? 'text-red-500' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
