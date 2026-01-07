import { Code, FileText, Lightbulb, MessageSquare, Sparkles, BookOpen } from 'lucide-react';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    label: 'Write code',
    icon: <Code size={16} />,
    prompt: 'Help me write code for ',
  },
  {
    label: 'Explain concept',
    icon: <Lightbulb size={16} />,
    prompt: 'Explain the concept of ',
  },
  {
    label: 'Summarize text',
    icon: <FileText size={16} />,
    prompt: 'Summarize the following text: ',
  },
  {
    label: 'Brainstorm ideas',
    icon: <Sparkles size={16} />,
    prompt: 'Help me brainstorm ideas for ',
  },
  {
    label: 'Answer questions',
    icon: <MessageSquare size={16} />,
    prompt: 'I have a question about ',
  },
  {
    label: 'Learn something',
    icon: <BookOpen size={16} />,
    prompt: 'Teach me about ',
  },
];

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void;
}

export function QuickActions({ onSelectAction }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6">
      {quickActions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelectAction(action.prompt)}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded-full text-sm font-medium transition-all duration-150 border border-transparent hover:border-border-light"
        >
          <span className="text-text-tertiary">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
