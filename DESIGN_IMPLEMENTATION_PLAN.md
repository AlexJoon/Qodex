# Qodex Design Implementation Plan

## Design Analysis from Reference Screenshots

### Screenshot 2 (Claude) - Key Elements:
- **Sidebar**: Clean, minimal with clear hierarchy
  - Logo + brand name at top
  - "New chat" button prominent
  - Section headers (Chats, Projects, Artifacts, Code)
  - Recent conversations list with truncated titles
  - User profile at bottom with plan indicator
- **Main Area**:
  - Personalized greeting centered
  - Large, centered input with placeholder
  - Quick action chips below input (Code, Write, Learn, etc.)
  - Model selector dropdown in input area

### Screenshot 3 (Perplexity) - Key Elements:
- **Sidebar**:
  - "Library" header with settings icon
  - "Recent" section label
  - Scrollable conversation history
  - "View All" link at bottom
- **Main Area**:
  - Large centered logo/brand
  - Centered search-style input
  - Icon buttons inside input (search, deep research, etc.)
  - Quick topic chips below (Perplexity 101, Flashcards, etc.)

### Screenshot 4 (Copilot) - Key Elements:
- **Sidebar**:
  - Logo + "Copilot" brand
  - Navigation items (Discover, Shopping, Imagine, Library, Labs)
  - "Conversations" section with date groupings
  - Clean hover states
- **Main Area**:
  - Friendly greeting text centered
  - Rounded input with "+" button and voice icon
  - "Smart" mode selector inside input
  - Suggestion chips in pill style (Create an image, Simplify a topic, etc.)
  - Sign in prompt at bottom

---

## Qodex Design System (Light Theme)

### Color Palette

```css
/* Primary Brand Colors */
--qodex-primary: #2563eb;        /* Blue - primary actions */
--qodex-primary-hover: #1d4ed8;  /* Blue hover */
--qodex-primary-light: #eff6ff;  /* Blue tint for backgrounds */

/* Neutral Colors */
--bg-primary: #ffffff;           /* Main background */
--bg-secondary: #f8fafc;         /* Sidebar, cards */
--bg-tertiary: #f1f5f9;          /* Hover states, borders */
--bg-input: #ffffff;             /* Input backgrounds */

/* Text Colors */
--text-primary: #0f172a;         /* Headings, primary text */
--text-secondary: #475569;       /* Body text, descriptions */
--text-tertiary: #94a3b8;        /* Placeholders, muted */

/* Border Colors */
--border-light: #e2e8f0;         /* Light borders */
--border-medium: #cbd5e1;        /* Medium borders */

/* Provider Colors (for toggles) */
--provider-openai: #10a37f;
--provider-mistral: #ff7000;
--provider-claude: #d97706;
--provider-cohere: #0d9488;

/* Status Colors */
--success: #22c55e;
--error: #ef4444;
--warning: #f59e0b;
```

### Typography

```css
/* Font Family */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing & Layout

```css
/* Spacing Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */

/* Border Radius */
--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
--radius-2xl: 1.5rem;   /* 24px */
--radius-full: 9999px;  /* Pill shape */

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-input: 0 0 0 3px rgba(37, 99, 235, 0.1);
```

---

## Component Architecture

### Phase 1: Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              App Container                               │
├────────────────────┬────────────────────────────────────────────────────┤
│                    │                                                     │
│      Sidebar       │                   Main Content                      │
│      (280px)       │                                                     │
│                    │  ┌─────────────────────────────────────────────┐   │
│  ┌──────────────┐  │  │              Header (optional)              │   │
│  │    Logo      │  │  └─────────────────────────────────────────────┘   │
│  │   + Brand    │  │                                                     │
│  └──────────────┘  │  ┌─────────────────────────────────────────────┐   │
│                    │  │                                             │   │
│  ┌──────────────┐  │  │            Chat Messages Area               │   │
│  │  New Chat    │  │  │         (scrollable, flex-grow)             │   │
│  │   Button     │  │  │                                             │   │
│  └──────────────┘  │  │     - Empty State (centered greeting)       │   │
│                    │  │     - Messages (max-width container)        │   │
│  ┌──────────────┐  │  │                                             │   │
│  │   Search     │  │  └─────────────────────────────────────────────┘   │
│  │   (opt.)     │  │                                                     │
│  └──────────────┘  │  ┌─────────────────────────────────────────────┐   │
│                    │  │                                             │   │
│  ┌──────────────┐  │  │           Input Area (fixed bottom)         │   │
│  │              │  │  │                                             │   │
│  │  Discussion  │  │  │  ┌─────────────────────────────────────┐   │   │
│  │    List      │  │  │  │  Provider Toggles (centered above)  │   │   │
│  │              │  │  │  └─────────────────────────────────────┘   │   │
│  │  - Recent    │  │  │                                             │   │
│  │  - Today     │  │  │  ┌─────────────────────────────────────┐   │   │
│  │  - Yesterday │  │  │  │         Chat Input Box              │   │   │
│  │  - Previous  │  │  │  │  [📎] [input............] [🎤] [➤]  │   │   │
│  │              │  │  │  └─────────────────────────────────────┘   │   │
│  └──────────────┘  │  │                                             │   │
│                    │  │  ┌─────────────────────────────────────┐   │   │
│  ┌──────────────┐  │  │  │    Quick Actions / Suggestions      │   │   │
│  │   User       │  │  │  └─────────────────────────────────────┘   │   │
│  │   Profile    │  │  │                                             │   │
│  └──────────────┘  │  └─────────────────────────────────────────────┘   │
│                    │                                                     │
└────────────────────┴────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Base Styling & Theme (Priority: Critical)
**Files to modify:**
- `frontend/src/index.css` - Global styles, CSS variables
- `frontend/tailwind.config.js` - Tailwind theme configuration

**Tasks:**
- [ ] 1.1 Define CSS custom properties (colors, spacing, typography)
- [ ] 1.2 Configure Tailwind for light theme
- [ ] 1.3 Remove dark mode media queries
- [ ] 1.4 Set base body styles (light background, dark text)
- [ ] 1.5 Define component-level utility classes

### Phase 2: Sidebar Redesign (Priority: High)
**Files to modify:**
- `frontend/src/components/sidebar/Sidebar.tsx`
- `frontend/src/components/sidebar/DiscussionItem.tsx`
- New: `frontend/src/components/sidebar/SidebarHeader.tsx`
- New: `frontend/src/components/sidebar/SidebarSearch.tsx`
- New: `frontend/src/components/sidebar/UserProfile.tsx`

**Tasks:**
- [ ] 2.1 Create SidebarHeader component (logo, brand, collapse toggle)
- [ ] 2.2 Style "New Chat" button (prominent, full-width)
- [ ] 2.3 Add optional search/filter input
- [ ] 2.4 Group discussions by date (Today, Yesterday, Previous 7 Days, Older)
- [ ] 2.5 Redesign DiscussionItem with cleaner hover states
- [ ] 2.6 Add section headers with counts
- [ ] 2.7 Create UserProfile component for bottom of sidebar
- [ ] 2.8 Add smooth transitions and hover effects

### Phase 3: Main Content Area - Empty State (Priority: High)
**Files to modify:**
- `frontend/src/components/chat/ChatArea.tsx`
- New: `frontend/src/components/chat/EmptyState.tsx`
- New: `frontend/src/components/chat/QuickActions.tsx`

**Tasks:**
- [ ] 3.1 Create centered empty state component
- [ ] 3.2 Add greeting text (can be personalized or generic)
- [ ] 3.3 Design QuickActions chips component
- [ ] 3.4 Position input centered for empty state
- [ ] 3.5 Smooth transition when first message sent

### Phase 4: Chat Input Redesign (Priority: High)
**Files to modify:**
- `frontend/src/components/chat/ChatInput.tsx`
- `frontend/src/components/chat/ProviderToggles.tsx`
- `frontend/src/components/chat/FileUpload.tsx`
- `frontend/src/components/chat/VoiceInput.tsx`

**Tasks:**
- [ ] 4.1 Redesign input container (rounded, shadow, border)
- [ ] 4.2 Position file upload icon inside input (left)
- [ ] 4.3 Position voice input inside input (right, before send)
- [ ] 4.4 Style send button (colored, rounded)
- [ ] 4.5 Redesign provider toggles as compact pills
- [ ] 4.6 Add subtle animations on focus/type
- [ ] 4.7 Fixed positioning at bottom of viewport

### Phase 5: Chat Messages Styling (Priority: Medium)
**Files to modify:**
- `frontend/src/components/chat/ChatMessage.tsx`
- New: `frontend/src/components/chat/MessageAvatar.tsx`

**Tasks:**
- [ ] 5.1 Redesign message bubbles for light theme
- [ ] 5.2 Style user messages (right-aligned or full-width)
- [ ] 5.3 Style assistant messages with provider badge
- [ ] 5.4 Improve code block styling
- [ ] 5.5 Add copy button to code blocks
- [ ] 5.6 Improve markdown rendering styles
- [ ] 5.7 Add message timestamps (subtle)

### Phase 6: Common Components Polish (Priority: Medium)
**Files to modify:**
- `frontend/src/components/common/Modal.tsx`
- `frontend/src/components/common/Dropdown.tsx`
- New: `frontend/src/components/common/Button.tsx`
- New: `frontend/src/components/common/Input.tsx`
- New: `frontend/src/components/common/Tooltip.tsx`

**Tasks:**
- [ ] 6.1 Create reusable Button component with variants
- [ ] 6.2 Create reusable Input component
- [ ] 6.3 Restyle Modal for light theme
- [ ] 6.4 Restyle Dropdown for light theme
- [ ] 6.5 Add Tooltip component for icons

### Phase 7: Animations & Micro-interactions (Priority: Low)
**Tasks:**
- [ ] 7.1 Sidebar collapse/expand animation
- [ ] 7.2 Message appear animation
- [ ] 7.3 Button hover/click feedback
- [ ] 7.4 Loading states and skeletons
- [ ] 7.5 Streaming cursor animation refinement

---

## Detailed Component Specifications

### Sidebar Component

```
Width: 280px (collapsible to 72px)
Background: var(--bg-secondary) / #f8fafc
Border-right: 1px solid var(--border-light)

Header:
  - Height: 64px
  - Logo: 32x32px
  - Brand text: 20px, semibold
  - Collapse button: 32x32px, right side

New Chat Button:
  - Full width minus padding
  - Height: 44px
  - Background: var(--qodex-primary)
  - Text: white, medium weight
  - Border-radius: var(--radius-lg)
  - Icon: Plus, 20px

Discussion List:
  - Section headers: 12px, uppercase, text-tertiary
  - Item height: 44px
  - Item padding: 12px 16px
  - Hover: bg-tertiary
  - Active: bg-primary-light, text-primary
  - Truncate text with ellipsis

User Profile:
  - Height: 64px
  - Avatar: 36px circle
  - Name: 14px, medium
  - Plan badge: 12px, text-tertiary
```

### Chat Input Component

```
Container:
  - Max-width: 768px
  - Margin: 0 auto
  - Padding: 16px 24px
  - Position: sticky bottom

Input Box:
  - Background: white
  - Border: 1px solid var(--border-medium)
  - Border-radius: var(--radius-2xl)
  - Box-shadow: var(--shadow-md)
  - Padding: 12px 16px
  - Min-height: 52px
  - Max-height: 200px

  On Focus:
    - Border-color: var(--qodex-primary)
    - Box-shadow: var(--shadow-input)

Icons Inside:
  - Left: Paperclip (file upload)
  - Right: Microphone, Send button
  - Icon size: 20px
  - Icon color: var(--text-tertiary)
  - Hover: var(--text-secondary)

Send Button:
  - Width: 36px
  - Height: 36px
  - Background: var(--qodex-primary)
  - Border-radius: var(--radius-full)
  - Icon: Arrow up, white

Provider Toggles:
  - Position: centered above input
  - Gap: 8px
  - Pill style buttons
  - Height: 32px
  - Padding: 0 12px
  - Border-radius: var(--radius-full)
  - Inactive: bg-tertiary, text-secondary
  - Active: provider-specific color, white text
```

### Empty State Component

```
Container:
  - Flex center (both axes)
  - Full height of content area

Content:
  - Max-width: 600px
  - Text-align: center

Greeting:
  - Font-size: 32px
  - Font-weight: semibold
  - Color: var(--text-primary)
  - Margin-bottom: 8px

Subtext:
  - Font-size: 16px
  - Color: var(--text-secondary)
  - Margin-bottom: 32px

Quick Actions:
  - Flex wrap, centered
  - Gap: 8px
  - Pill buttons
  - Height: 36px
  - Background: var(--bg-tertiary)
  - Hover: var(--border-medium)
  - Border-radius: var(--radius-full)
```

---

## File Checklist

### New Files to Create:
- [ ] `frontend/src/components/sidebar/SidebarHeader.tsx`
- [ ] `frontend/src/components/sidebar/SidebarSearch.tsx`
- [ ] `frontend/src/components/sidebar/UserProfile.tsx`
- [ ] `frontend/src/components/sidebar/DiscussionGroup.tsx`
- [ ] `frontend/src/components/chat/EmptyState.tsx`
- [ ] `frontend/src/components/chat/QuickActions.tsx`
- [ ] `frontend/src/components/common/Button.tsx`
- [ ] `frontend/src/components/common/Input.tsx`
- [ ] `frontend/src/components/common/Tooltip.tsx`

### Files to Modify:
- [ ] `frontend/src/index.css`
- [ ] `frontend/tailwind.config.js`
- [ ] `frontend/src/App.tsx`
- [ ] `frontend/src/components/sidebar/Sidebar.tsx`
- [ ] `frontend/src/components/sidebar/DiscussionItem.tsx`
- [ ] `frontend/src/components/chat/ChatArea.tsx`
- [ ] `frontend/src/components/chat/ChatInput.tsx`
- [ ] `frontend/src/components/chat/ChatMessage.tsx`
- [ ] `frontend/src/components/chat/ProviderToggles.tsx`
- [ ] `frontend/src/components/chat/FileUpload.tsx`
- [ ] `frontend/src/components/chat/VoiceInput.tsx`
- [ ] `frontend/src/components/common/Modal.tsx`
- [ ] `frontend/src/components/common/Dropdown.tsx`

---

## Guardrail Checkpoints

### After Phase 1 (Base Styling):
```
□ Light theme applied globally
□ No dark mode styles present
□ CSS variables defined and working
□ Tailwind config updated
□ Base typography correct
```

### After Phase 2 (Sidebar):
```
□ Sidebar width is 280px
□ Logo and brand visible
□ New Chat button styled and functional
□ Discussions grouped by date
□ Hover states work
□ User profile section at bottom
```

### After Phase 3 (Empty State):
```
□ Greeting centered when no messages
□ Quick action chips displayed
□ Input centered in empty state
□ Smooth transition to chat mode
```

### After Phase 4 (Chat Input):
```
□ Input has rounded design with shadow
□ Icons positioned inside input
□ Provider toggles are pill-shaped
□ Send button is circular and colored
□ Fixed at bottom of viewport
```

### After Phase 5 (Messages):
```
□ Messages styled for light theme
□ Provider badges visible
□ Code blocks have copy button
□ Markdown renders correctly
□ Streaming animation works
```

### Final Verification:
```
□ No dark backgrounds anywhere
□ Consistent spacing throughout
□ All hover states work
□ Responsive on different screen sizes
□ Matches enterprise AI platform aesthetic
□ All functionality preserved
```

---

## Progress Tracking

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Base Styling | Not Started | 0% |
| Phase 2: Sidebar | Not Started | 0% |
| Phase 3: Empty State | Not Started | 0% |
| Phase 4: Chat Input | Not Started | 0% |
| Phase 5: Messages | Not Started | 0% |
| Phase 6: Common Components | Not Started | 0% |
| Phase 7: Animations | Not Started | 0% |

**Last Updated:** 2026-01-07
**Current Focus:** Ready to begin Phase 1
