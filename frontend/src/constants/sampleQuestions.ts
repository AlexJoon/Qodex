import { SampleQuestion } from '../types/sampleQuestions';

// Sample questions for first-time users with nested sub-questions
// Contextually related to prompt starter themes
export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    main: "Summarize key findings from my research documents",
    subQuestions: [
      { text: "Create an executive summary of main points" },
      { text: "Extract key statistics and data" },
      { text: "Identify recurring themes" },
      { text: "Compare findings across documents" }
    ]
  },
  {
    main: "Help me analyze data patterns and trends",
    subQuestions: [
      { text: "Identify correlations in the data" },
      { text: "Spot anomalies and outliers" },
      { text: "Predict future trends" },
      { text: "Compare time-series data" }
    ]
  },
  {
    main: "Explain complex scientific concepts in simple terms",
    subQuestions: [
      { text: "Break down technical jargon" },
      { text: "Use analogies and examples" },
      { text: "Create a step-by-step explanation" },
      { text: "Highlight key takeaways" }
    ]
  },
  {
    main: "Review and provide feedback on my draft",
    subQuestions: [
      { text: "Check grammar and clarity" },
      { text: "Improve structure and flow" },
      { text: "Strengthen arguments" },
      { text: "Suggest style improvements" }
    ]
  },
  {
    main: "Generate ideas for my creative project",
    subQuestions: [
      { text: "Brainstorm unique concepts" },
      { text: "Explore different approaches" },
      { text: "Combine existing ideas creatively" },
      { text: "Identify inspiration sources" }
    ]
  },
  {
    main: "Answer questions about my uploaded materials",
    subQuestions: [
      { text: "Extract specific information" },
      { text: "Clarify confusing sections" },
      { text: "Connect related concepts" },
      { text: "Summarize key sections" }
    ]
  }
];
