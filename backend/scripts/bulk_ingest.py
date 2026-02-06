#!/usr/bin/env python3
"""
Bulk Document Ingestion Script for Qodex

This script reads all supported documents from a folder and uploads them
to Pinecone via the document service with deduplication support.

Usage:
    python scripts/bulk_ingest.py /path/to/documents/folder [concurrency] [--force]

Options:
    concurrency: Number of concurrent uploads (default: 3)
    --force: Skip deduplication check and upload all files

Supported file types: .pdf, .docx, .txt, .md
"""

import sys
import os
import asyncio
import hashlib
from pathlib import Path
from typing import List, Tuple, Set

# Add the backend app to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.document_service import get_document_service
from app.services.pinecone_service import get_pinecone_service
from app.models.document import Document

SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.txt', '.md'}

CONTENT_TYPE_MAP = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
}


# =============================================================================
# Deduplication Functions
# =============================================================================

async def get_existing_filenames_from_pinecone() -> Set[str]:
    """
    Fetch all existing document filenames from Pinecone.

    Returns:
        Set of filenames that already exist in the vector database
    """
    pinecone_service = get_pinecone_service()
    existing_filenames = set()

    try:
        # Use a dummy embedding to query for documents
        dummy_embedding = [0.0] * 1536

        # Query for a large number of results to get unique filenames
        results = await pinecone_service.query_vectors(
            query_embedding=dummy_embedding,
            top_k=10000,
            include_metadata=True
        )

        for result in results:
            if result.get("metadata") and result["metadata"].get("filename"):
                existing_filenames.add(result["metadata"]["filename"])

        print(f"Found {len(existing_filenames)} unique documents already in Pinecone")

    except Exception as e:
        print(f"Warning: Could not fetch existing filenames: {e}")
        print("Proceeding without deduplication check...")

    return existing_filenames


def filter_duplicates(
    files: List[Path],
    existing_filenames: Set[str]
) -> Tuple[List[Path], List[Path]]:
    """
    Filter out files that already exist in Pinecone.

    Args:
        files: List of file paths to check
        existing_filenames: Set of filenames already in Pinecone

    Returns:
        Tuple of (new_files, skipped_files)
    """
    new_files = []
    skipped_files = []

    for file_path in files:
        if file_path.name in existing_filenames:
            skipped_files.append(file_path)
        else:
            new_files.append(file_path)

    return new_files, skipped_files


# =============================================================================
# File Discovery
# =============================================================================

def get_files_from_folder(folder_path: str) -> List[Path]:
    """Get all supported files from a folder (recursive)."""
    folder = Path(folder_path)

    if not folder.exists():
        raise ValueError(f"Folder does not exist: {folder_path}")

    if not folder.is_dir():
        raise ValueError(f"Path is not a directory: {folder_path}")

    files = []
    for ext in SUPPORTED_EXTENSIONS:
        files.extend(folder.rglob(f"*{ext}"))

    return sorted(files)


async def ingest_file(doc_service, file_path: Path) -> Tuple[bool, str, str]:
    """
    Ingest a single file.

    Returns:
        Tuple of (success, filename, message)
    """
    try:
        content = file_path.read_bytes()
        content_type = CONTENT_TYPE_MAP.get(file_path.suffix.lower(), 'application/octet-stream')

        document = await doc_service.process_document(
            filename=file_path.name,
            content=content,
            content_type=content_type
        )

        return True, file_path.name, f"Created {document.chunk_count} chunks"

    except Exception as e:
        return False, file_path.name, str(e)


async def bulk_ingest(folder_path: str, concurrency: int = 3, force: bool = False):
    """
    Ingest all documents from a folder with deduplication.

    Args:
        folder_path: Path to the folder containing documents
        concurrency: Number of concurrent uploads (be gentle on the API)
        force: If True, skip deduplication and upload all files
    """
    print(f"\n{'='*60}")
    print("Qodex Bulk Document Ingestion")
    print(f"{'='*60}\n")

    # Get all files
    all_files = get_files_from_folder(folder_path)

    if not all_files:
        print(f"No supported files found in: {folder_path}")
        print(f"Supported extensions: {', '.join(SUPPORTED_EXTENSIONS)}")
        return

    print(f"Found {len(all_files)} documents in folder")
    print(f"Folder: {folder_path}")
    print(f"Concurrency: {concurrency}")

    # Deduplication check
    skipped_files = []
    if force:
        print(f"Force mode: skipping deduplication check")
        files = all_files
    else:
        print(f"\nChecking for duplicates in Pinecone...")
        existing_filenames = await get_existing_filenames_from_pinecone()
        files, skipped_files = filter_duplicates(all_files, existing_filenames)

        if skipped_files:
            print(f"Skipping {len(skipped_files)} files (already exist in Pinecone)")

        if not files:
            print(f"\nAll files already exist in Pinecone. Nothing to upload.")
            return

    print(f"\nWill upload {len(files)} new documents")
    print(f"\n{'-'*60}\n")

    # Get document service
    doc_service = get_document_service()

    # Process files with limited concurrency
    semaphore = asyncio.Semaphore(concurrency)

    async def process_with_semaphore(file_path: Path, index: int):
        async with semaphore:
            success, filename, message = await ingest_file(doc_service, file_path)
            status = "✓" if success else "✗"
            print(f"[{index + 1}/{len(files)}] {status} {filename}")
            if not success:
                print(f"         Error: {message}")
            else:
                print(f"         {message}")
            return success, filename, message

    # Run all tasks
    tasks = [
        process_with_semaphore(file_path, i)
        for i, file_path in enumerate(files)
    ]

    results = await asyncio.gather(*tasks)

    # Summary
    successful = sum(1 for r in results if r[0])
    failed = len(results) - successful

    print(f"\n{'-'*60}")
    print(f"\nIngestion Complete!")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Skipped (duplicates): {len(skipped_files)}")
    print(f"  Total in folder: {len(all_files)}")

    if failed > 0:
        print(f"\nFailed files:")
        for success, filename, message in results:
            if not success:
                print(f"  - {filename}: {message}")

    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/bulk_ingest.py /path/to/documents/folder [concurrency] [--force]")
        print("\nOptions:")
        print("  concurrency: Number of concurrent uploads (default: 3)")
        print("  --force: Skip deduplication check and upload all files")
        print("\nExample:")
        print("  python scripts/bulk_ingest.py ~/Documents/knowledge-base")
        print("  python scripts/bulk_ingest.py ~/Documents/knowledge-base 5")
        print("  python scripts/bulk_ingest.py ~/Documents/knowledge-base 3 --force")
        sys.exit(1)

    folder_path = sys.argv[1]

    # Parse arguments
    concurrency = 3
    force = False

    for arg in sys.argv[2:]:
        if arg == "--force":
            force = True
        else:
            try:
                concurrency = int(arg)
            except ValueError:
                print(f"Invalid argument: {arg}")
                sys.exit(1)

    # Run the ingestion
    asyncio.run(bulk_ingest(folder_path, concurrency, force))


if __name__ == "__main__":
    main()
