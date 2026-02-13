#!/usr/bin/env python3
"""
Clear all vectors from Pinecone index.

Usage:
    python scripts/clear_pinecone.py
"""

import sys
import os
import asyncio

# Add the backend app to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.pinecone_service import get_pinecone_service


async def clear_index():
    """Delete all vectors from Pinecone index."""
    print("\n" + "="*60)
    print("Clearing Pinecone Index")
    print("="*60 + "\n")

    pinecone_service = get_pinecone_service()

    try:
        # Get index stats first
        index = pinecone_service._get_index()
        stats = index.describe_index_stats()

        print(f"Current index stats:")
        print(f"  Total vectors: {stats.get('total_vector_count', 0)}")
        print(f"  Namespaces: {stats.get('namespaces', {})}")
        print()

        # Delete from all namespaces
        namespaces = stats.get('namespaces', {})
        if namespaces:
            for namespace_name in namespaces.keys():
                print(f"Deleting all vectors from namespace: {namespace_name}...")
                await pinecone_service.delete_vectors(delete_all=True, namespace=namespace_name)
        else:
            print("No namespaces found with vectors")

        print("\n✓ Successfully deleted all vectors from Pinecone")

        # Verify deletion
        stats_after = index.describe_index_stats()
        remaining = stats_after.get('total_vector_count', 0)
        if remaining > 0:
            print(f"\n⚠ Warning: {remaining} vectors still remain")
            print("You may need to wait a moment for deletion to propagate, then run again.")
        else:
            print("✓ Verified: Index is now empty")

        print("\nThe index is ready for re-indexing.\n")
    except Exception as e:
        print(f"✗ Error clearing index: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(clear_index())
