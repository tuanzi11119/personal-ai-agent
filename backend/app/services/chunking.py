"""Text chunking with paragraph awareness and overlap."""

from __future__ import annotations

import re

_WHITESPACE = re.compile(r"[ \t\xa0]+")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [_WHITESPACE.sub(" ", line).strip() for line in text.split("\n")]
    return "\n".join(lines).strip()


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """Split text into overlapping chunks, preferring paragraph boundaries."""
    text = normalize_text(text)
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[str] = []
    buffer = ""
    for paragraph in paragraphs:
        candidate = f"{buffer}\n{paragraph}".strip() if buffer else paragraph
        if len(candidate) <= chunk_size:
            buffer = candidate
            continue
        if buffer:
            chunks.append(buffer)
        if len(paragraph) <= chunk_size:
            buffer = paragraph
        else:
            for start in range(0, len(paragraph), max(1, chunk_size - overlap)):
                piece = paragraph[start : start + chunk_size]
                if piece.strip():
                    chunks.append(piece.strip())
            buffer = ""
    if buffer:
        chunks.append(buffer)

    # Add overlap between consecutive chunks for better recall at boundaries.
    if overlap > 0 and len(chunks) > 1:
        overlapped: list[str] = []
        for index, chunk in enumerate(chunks):
            if index == 0:
                overlapped.append(chunk)
                continue
            tail = chunks[index - 1][-overlap:]
            overlapped.append(f"{tail}{chunk}" if tail else chunk)
        chunks = overlapped

    return [c.strip() for c in chunks if c.strip()][:400]
