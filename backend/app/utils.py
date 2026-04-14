import re


def slugify(name: str) -> str:
    """Convert a name to a URL-friendly slug."""
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return s.strip("-") or "canteen"
