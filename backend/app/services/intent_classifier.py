"""
Lightweight intent classifier for user messages.
Uses regex pattern matching — zero latency, no LLM call.
"""
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class IntentResult:
    """Result of intent classification."""
    intent: str          # Machine key: "summarize", "case_study", etc.
    label: str           # Display label: "Summary", "Case Study", etc.
    prompt_suffix: str   # Appended to system prompt


# Intent definitions: (intent_key, display_label, patterns, prompt_suffix)
INTENT_DEFINITIONS = [
    {
        "intent": "summarize",
        "label": "Summary",
        "patterns": [
            r"\bsummar(y|ize|ise)\b",
            r"\boverview\b",
            r"\bwhat is this (about|document)\b",
            r"\bkey (points|takeaways|findings)\b",
            r"\btl;?dr\b",
            r"\bgist\b",
            r"\bhigh[- ]?level\b",
            r"\bmain (ideas?|themes?|points?)\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Summary\n"
            "Structure your response with clear markdown headings:\n"
            "### Key Findings\n"
            "- Bullet the most important findings or claims (3-5 points)\n"
            "### Methodology\n"
            "- Briefly describe the approach, data sources, or framework used\n"
            "### Implications\n"
            "- What does this mean for climate policy, education, or practice?\n"
            "### Limitations\n"
            "- Note any caveats, gaps, or scope boundaries\n\n"
            "Use precise language. Distinguish between evidence-backed claims and interpretive statements."
        ),
    },
    {
        "intent": "explain",
        "label": "Explainer",
        "patterns": [
            r"\bexplain\b",
            r"\bsimpl(er|ify|e terms)\b",
            r"\bbreak (it |this )?down\b",
            r"\bwhat does .+ mean\b",
            r"\bdefine\b",
            r"\bin (plain|simple|layman|everyday) (terms|language|words)\b",
            r"\bhelp me understand\b",
            r"\bwhat is .+ in the context\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Explanation\n"
            "Write for someone encountering this topic for the first time:\n"
            "- Define all technical terms inline using parenthetical definitions\n"
            "- Use concrete analogies to ground abstract concepts\n"
            "- Build from foundational ideas to complex ones\n"
            "- Use short paragraphs (2-3 sentences max)\n"
            "- Highlight cause-and-effect relationships explicitly\n"
            "- End with a 'Key Takeaway' sentence that captures the core idea\n\n"
            "Avoid jargon without explanation. If a term is domain-specific, explain it."
        ),
    },
    {
        "intent": "compare",
        "label": "Comparison",
        "patterns": [
            r"\bcompar(e|ison|ing)\b",
            r"\bdifferen(ce|t|ces|tiate)\b",
            r"\bcontrast\b",
            r"\bversus\b|\bvs\.?\b",
            r"\bhow (does|do) .+ differ\b",
            r"\bsimilarit(y|ies)\b",
            r"\brelat(e|ionship) between\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Comparison\n"
            "Structure your comparison clearly:\n"
            "### Dimensions of Comparison\n"
            "- Identify the key dimensions or criteria being compared\n"
            "### Analysis\n"
            "- For each dimension, present both sides with evidence from sources\n"
            "- Use a markdown table if comparing more than 2 items across 3+ dimensions\n"
            "### Synthesis\n"
            "- What patterns emerge? Where do they converge or diverge?\n"
            "- What are the practical implications of these differences?\n\n"
            "Be balanced — present each perspective with equal rigor."
        ),
    },
    {
        "intent": "case_study",
        "label": "Case Study",
        "patterns": [
            r"\bcase stud(y|ies)\b",
            r"\breal[- ]?world example\b",
            r"\bpractical (example|application|scenario)\b",
            r"\bapplication of\b",
            r"\bhow (is|are|was|were) .+ (used|applied|implemented)\b",
            r"\bin practice\b",
            r"\bscenario\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Case Study\n"
            "Frame your response as a structured case study:\n"
            "### Context\n"
            "- Setting, timeframe, and relevant background\n"
            "### Stakeholders\n"
            "- Who is involved and what are their roles or interests?\n"
            "### Key Challenge\n"
            "- What problem or question is being addressed?\n"
            "### Evidence & Analysis\n"
            "- What do the sources reveal? Include data points where available\n"
            "### Outcomes\n"
            "- What happened? What were the results or lessons learned?\n"
            "### Discussion Questions\n"
            "- Pose 2-3 questions suitable for classroom discussion\n\n"
            "Ground all claims in the source material. Flag any inferences clearly."
        ),
    },
    {
        "intent": "generate_questions",
        "label": "Assessment",
        "patterns": [
            r"\b(generate|create|write|give me|suggest|come up with) .*(questions?|quiz|exam|test|assessment)\b",
            r"\bquiz me\b",
            r"\btest me\b",
            r"\bquestions? (about|on|for|from)\b",
            r"\bassessment\b",
            r"\bexam (prep|questions?)\b",
            r"\bstudy (guide|questions?)\b",
            r"\bwhat questions? could\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Assessment Questions\n"
            "Generate questions at multiple cognitive levels (Bloom's Taxonomy):\n"
            "### Recall & Comprehension\n"
            "- 2-3 questions testing factual knowledge and understanding\n"
            "### Application & Analysis\n"
            "- 2-3 questions requiring application to new scenarios or analytical reasoning\n"
            "### Synthesis & Evaluation\n"
            "- 1-2 questions requiring integration of multiple concepts or critical evaluation\n"
            "### Answer Key\n"
            "- Provide concise model answers or key points for each question\n\n"
            "Questions should be specific to the source content, not generic. "
            "Include the cognitive level label in parentheses after each question."
        ),
    },
    {
        "intent": "critique",
        "label": "Critique",
        "patterns": [
            r"\bcritiqu(e|ing)\b",
            r"\bweakness(es)?\b",
            r"\blimitation(s)?\b",
            r"\bstrength(s)?\b",
            r"\bgap(s)? in\b",
            r"\bbias(es)?\b",
            r"\bshortcoming(s)?\b",
            r"\bcritical (analysis|review|assessment)\b",
            r"\bevaluat(e|ion)\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Critical Analysis\n"
            "Provide a balanced critical assessment:\n"
            "### Strengths\n"
            "- What does this do well? What is the strongest evidence or argument?\n"
            "### Weaknesses & Gaps\n"
            "- What is missing, underdeveloped, or potentially biased?\n"
            "- Are there methodological concerns?\n"
            "### Alternative Perspectives\n"
            "- What would critics or other schools of thought say?\n"
            "### Overall Assessment\n"
            "- Weigh the strengths against weaknesses\n"
            "- How should a reader calibrate their confidence in the claims?\n\n"
            "Distinguish between factual gaps and interpretive disagreements."
        ),
    },
    {
        "intent": "methodology",
        "label": "Methodology",
        "patterns": [
            r"\bmethodolog(y|ies|ical)\b",
            r"\bresearch (design|method|approach)\b",
            r"\bhow (did|do) they (study|research|measure|collect|analyze)\b",
            r"\bdata (collection|source|set)\b",
            r"\bsampl(e|ing)\b",
            r"\bexperimental (design|setup)\b",
            r"\bframework\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Methodology Review\n"
            "Describe the research methodology clearly:\n"
            "### Research Design\n"
            "- What type of study is this? (qualitative, quantitative, mixed methods, meta-analysis, etc.)\n"
            "### Data & Sources\n"
            "- What data was collected or used? What is the sample/scope?\n"
            "### Analytical Approach\n"
            "- How was the data analyzed? What tools or frameworks were applied?\n"
            "### Validity & Reliability\n"
            "- How robust is the methodology? Any concerns about generalizability?\n\n"
            "Be specific about what the sources actually describe vs. what you are inferring."
        ),
    },
    {
        "intent": "lesson_plan",
        "label": "Lesson Plan",
        "patterns": [
            r"\blesson plan\b",
            r"\bteaching (plan|strategy|approach|activity|activities)\b",
            r"\bhow (to|would you|should I) teach\b",
            r"\bclassroom (activity|activities|exercise|discussion)\b",
            r"\bcurriculum\b",
            r"\blearning (objectives?|outcomes?|goals?)\b",
            r"\bcourse (design|structure|outline)\b",
            r"\bpedagog(y|ical)\b",
            r"\binstructional\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Lesson Plan\n"
            "Design a practical teaching resource:\n"
            "### Learning Objectives\n"
            "- 2-4 specific, measurable objectives (use action verbs)\n"
            "### Key Concepts\n"
            "- List the core concepts students should understand\n"
            "### Teaching Activities\n"
            "- Describe 2-3 activities with format (lecture, discussion, group work, etc.)\n"
            "- Include estimated time for each\n"
            "### Discussion Prompts\n"
            "- 3-4 open-ended questions to drive classroom conversation\n"
            "### Assessment Ideas\n"
            "- How could instructors evaluate student understanding?\n"
            "### Recommended Readings\n"
            "- Reference relevant sources from the documents\n\n"
            "Target a graduate-level audience unless otherwise specified."
        ),
    },
]


def classify_intent(message: str) -> IntentResult:
    """
    Classify the user's message into an intent category.
    Returns the first matching intent, or a general fallback.

    Uses case-insensitive regex matching — zero latency.
    """
    message_lower = message.lower().strip()

    for definition in INTENT_DEFINITIONS:
        for pattern in definition["patterns"]:
            if re.search(pattern, message_lower):
                return IntentResult(
                    intent=definition["intent"],
                    label=definition["label"],
                    prompt_suffix=definition["prompt_suffix"],
                )

    # Fallback: general intent — enhanced base prompt for climate/education domain
    return IntentResult(
        intent="general",
        label="General",
        prompt_suffix=(
            "\n\n## Response Guidelines\n"
            "- Use clear markdown formatting with headings and bullet points where appropriate\n"
            "- Ground all claims in the source material with inline citations [N]\n"
            "- When relevant, note implications for climate policy, education, or practice\n"
            "- Distinguish between what sources state directly and your interpretive synthesis\n"
            "- If the sources don't cover the question adequately, say so explicitly"
        ),
    )
