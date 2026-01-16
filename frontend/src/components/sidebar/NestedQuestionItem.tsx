import { useRef, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SampleQuestion } from '../../types/sampleQuestions';

interface NestedQuestionItemProps {
  question: SampleQuestion;
  onQuestionSelect: (question: string) => void;
}

export function NestedQuestionItem({ question, onQuestionSelect }: NestedQuestionItemProps) {
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subMenuStyle, setSubMenuStyle] = useState<React.CSSProperties>({});
  const itemRef = useRef<HTMLButtonElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Position sub-menu to the right when it opens
  useEffect(() => {
    if (showSubMenu && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const subMenuWidth = 200;
      const gap = 4;

      // Default position: to the right
      let left = rect.right + gap;
      let top = rect.top;

      // Check if sub-menu would overflow right edge
      if (left + subMenuWidth > viewportWidth) {
        // Position to the left instead
        left = rect.left - subMenuWidth - gap;
      }

      // Check if sub-menu would overflow bottom
      const estimatedHeight = question.subQuestions.length * 40; // Rough estimate
      if (top + estimatedHeight > viewportHeight) {
        top = viewportHeight - estimatedHeight - 8;
      }

      setSubMenuStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${subMenuWidth}px`,
      });
    }
  }, [showSubMenu, question.subQuestions.length]);

  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Show sub-menu after delay
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSubMenu(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    // Clear timeout if user leaves before delay
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Hide sub-menu after slight delay (allows moving to sub-menu)
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSubMenu(false);
    }, 100);
  };

  const handleSubMenuMouseEnter = () => {
    // Cancel any pending close timeout when entering sub-menu
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleSubMenuMouseLeave = () => {
    // Close sub-menu when leaving
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSubMenu(false);
    }, 100);
  };

  const handleMainQuestionClick = () => {
    onQuestionSelect(question.main);
    setShowSubMenu(false);
  };

  const handleSubQuestionClick = (subQuestionText: string) => {
    onQuestionSelect(subQuestionText);
    setShowSubMenu(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <button
        ref={itemRef}
        className="sample-question-item sample-question-item-with-sub"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleMainQuestionClick}
        aria-haspopup="true"
        aria-expanded={showSubMenu}
      >
        <span className="sample-question-item-text">{question.main}</span>
        <ChevronRight size={14} className="sample-question-item-chevron" />
      </button>

      {showSubMenu && (
        <div
          className="sample-questions-submenu"
          style={subMenuStyle}
          onMouseEnter={handleSubMenuMouseEnter}
          onMouseLeave={handleSubMenuMouseLeave}
        >
          {question.subQuestions.map((subQuestion, index) => (
            <button
              key={index}
              className="sample-subquestion-item"
              onClick={() => handleSubQuestionClick(subQuestion.text)}
            >
              {subQuestion.text}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
