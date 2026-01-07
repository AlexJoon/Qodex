#!/usr/bin/env python3
"""
Bulk Document Ingestion Script for Qodex

This script reads all supported documents from a folder and uploads them
to Pinecone via the document service.

Usage:
    python scripts/bulk_ingest.py /path/to/documents/folder

Supported file types: .pdf, .docx, .txt, .md
"""

import sys
import os
import asyncio
from pathlib import Path
from typing import List, Tuple

# Add the backend app to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.document_service import get_document_service
from app.models.document import Document

SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.txt', '.md'}

CONTENT_TYPE_MAP = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
}


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


async def bulk_ingest(folder_path: str, concurrency: int = 3):
    """
    Ingest all documents from a folder.

    Args:
        folder_path: Path to the folder containing documents
        concurrency: Number of concurrent uploads (be gentle on the API)
    """
    print(f"\n{'='*60}")
    print("Qodex Bulk Document Ingestion")
    print(f"{'='*60}\n")

    # Get all files
    files = get_files_from_folder(folder_path)

    if not files:
        print(f"No supported files found in: {folder_path}")
        print(f"Supported extensions: {', '.join(SUPPORTED_EXTENSIONS)}")
        return

    print(f"Found {len(files)} documents to ingest")
    print(f"Folder: {folder_path}")
    print(f"Concurrency: {concurrency}")
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
    print(f"  Total: {len(files)}")

    if failed > 0:
        print(f"\nFailed files:")
        for success, filename, message in results:
            if not success:
                print(f"  - {filename}: {message}")

    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/bulk_ingest.py /path/to/documents/folder")
        print("\nExample:")
        print("  python scripts/bulk_ingest.py ~/Documents/knowledge-base")
        sys.exit(1)

    folder_path = sys.argv[1]

    # Optional concurrency argument
    concurrency = 3
    if len(sys.argv) >= 3:
        try:
            concurrency = int(sys.argv[2])
        except ValueError:
            print(f"Invalid concurrency value: {sys.argv[2]}")
            sys.exit(1)

    # Run the ingestion
    asyncio.run(bulk_ingest(folder_path, concurrency))


if __name__ == "__main__":
    main()
