"""
Supabase client singleton for database operations.
Initializes connection using application settings.
"""
from supabase import create_client, Client
from typing import Optional

from app.core.config import get_settings

# Global client instance
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """
    Get or create Supabase client singleton.

    Returns:
        Client: Initialized Supabase client

    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_KEY not set
    """
    global _supabase_client

    if _supabase_client is None:
        settings = get_settings()
        supabase_url = settings.supabase_url
        # Prefer service role key (bypasses RLS) for backend operations;
        # fall back to anon key for backwards compatibility.
        supabase_key = settings.supabase_service_role_key or settings.supabase_key

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set"
            )

        _supabase_client = create_client(supabase_url, supabase_key)
        print(f"✓ Supabase client initialized: {supabase_url}")

    return _supabase_client

def reset_supabase_client():
    """Reset the Supabase client singleton (useful for testing)"""
    global _supabase_client
    _supabase_client = None
