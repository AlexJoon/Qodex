"""
Research Mode Configuration - Single source of truth for research depth settings.

Defines three research modes with different top_k values and prompt enhancements:
- Quick (7 sources): Fast, focused answers
- Enhanced (12 sources): Balanced depth with multiple perspectives
- Deep Research (16 sources): Exhaustive scholarly analysis
"""
from dataclasses import dataclass
from enum import Enum
from typing import Dict


class ResearchMode(str, Enum):
    """Research mode identifiers."""
    QUICK = "quick"
    ENHANCED = "enhanced"
    DEEP = "deep"


@dataclass
class ResearchModeConfig:
    """Configuration for a research mode."""
    mode: ResearchMode
    label: str              # Display name for UI
    description: str        # UI tooltip/description
    top_k: int              # Number of sources to retrieve
    prompt_enhancement: str # Additional system prompt instructions


RESEARCH_MODE_DEFINITIONS: Dict[ResearchMode, ResearchModeConfig] = {
    ResearchMode.QUICK: ResearchModeConfig(
        mode=ResearchMode.QUICK,
        label="Quick",
        description="Fast answers with key sources (7 sources)",
        top_k=7,
        prompt_enhancement=(
            "\n\n## Research Depth: Quick\n"
            "Provide a focused, efficient response:\n"
            "- Prioritize the most relevant and authoritative sources\n"
            "- Give direct answers with key supporting evidence\n"
            "- Keep synthesis concise - focus on main findings\n"
            "- Use 2-4 citations for the most important claims"
        ),
    ),
    ResearchMode.ENHANCED: ResearchModeConfig(
        mode=ResearchMode.ENHANCED,
        label="Enhanced",
        description="Balanced depth with broader coverage (12 sources)",
        top_k=12,
        prompt_enhancement=(
            "\n\n## Research Depth: Enhanced\n"
            "Provide a thorough, well-rounded response:\n"
            "- Draw from multiple sources to build a comprehensive picture\n"
            "- Include supporting evidence and relevant context\n"
            "- Note areas of consensus and any divergent findings\n"
            "- Synthesize across sources to identify patterns\n"
            "- Use 4-8 citations distributed across your response"
        ),
    ),
    ResearchMode.DEEP: ResearchModeConfig(
        mode=ResearchMode.DEEP,
        label="Deep Research",
        description="Exhaustive analysis with maximum sources (16 sources)",
        top_k=16,
        prompt_enhancement=(
            "\n\n## Research Depth: Deep Research\n"
            "Provide an exhaustive, scholarly response:\n"
            "- Conduct a comprehensive review across all available sources\n"
            "- Present nuanced analysis with multiple perspectives\n"
            "- Identify methodological approaches, strengths, and limitations\n"
            "- Synthesize findings into coherent themes and patterns\n"
            "- Note gaps in the literature and areas of uncertainty\n"
            "- Discuss implications for policy, practice, or further research\n"
            "- Use extensive citations (8+) to ground all claims"
        ),
    ),
}


# Default mode for new requests
DEFAULT_RESEARCH_MODE = ResearchMode.QUICK


def get_research_mode_config(mode: ResearchMode) -> ResearchModeConfig:
    """Get configuration for a research mode."""
    return RESEARCH_MODE_DEFINITIONS[mode]


def get_default_top_k() -> int:
    """Get the default top_k value (for backward compatibility)."""
    return RESEARCH_MODE_DEFINITIONS[DEFAULT_RESEARCH_MODE].top_k


def list_research_modes() -> list:
    """List all research modes with their configurations (for API endpoint)."""
    return [
        {
            "mode": config.mode.value,
            "label": config.label,
            "description": config.description,
            "top_k": config.top_k,
            "is_default": config.mode == DEFAULT_RESEARCH_MODE,
        }
        for config in RESEARCH_MODE_DEFINITIONS.values()
    ]
