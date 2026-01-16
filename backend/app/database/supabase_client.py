"""
Supabase client singleton for database operations.
Initializes connection using environment variables.
"""
from supabase import create_client, Client
import os
from typing import Optional

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
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables"
            )

        _supabase_client = create_client(supabase_url, supabase_key)
        print(f"✓ Supabase client initialized: {supabase_url}")

    return _supabase_client

def reset_supabase_client():
    """Reset the Supabase client singleton (useful for testing)"""
    global _supabase_client
    _supabase_client = None
