import './ThinkingIndicator.css';

interface ThinkingIndicatorProps {
  provider?: string;
}

export function ThinkingIndicator({ provider }: ThinkingIndicatorProps) {
  return (
    <div className="thinking-indicator">
      <div className="thinking-indicator-content">
        <span className="thinking-text">Thinking</span>
        <div className="thinking-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </div>
  );
}
