import json
import asyncio
from pathlib import Path
from models import RawLab

EXTRACTION_SCHEMA = {
    "lab_name": "string — the name of the lab",
    "overview": "string — 1 to 2 sentences describing what the lab researches",
    "members": [
        {
            "name": "string — full name",
            "role": "string — one of: PI, PhD, Postdoc, Masters, Undergrad, Staff",
            "email": "string (optional) — only if explicitly shown on page",
            "photo": "string (optional) — absolute URL to photo if found",
        }
    ],
}

SYSTEM_PROMPT = f"""You extract structured lab data from academic lab website content.

Output ONLY a JSON object matching this schema:
{json.dumps(EXTRACTION_SCHEMA, indent=2)}

Rules:
- Only include people explicitly listed on the page. Do not invent names.
- For role, pick the closest match from: PI, PhD, Postdoc, Masters, Undergrad, Staff
- Include email and photo only if they appear on the page
- Omit email and photo fields entirely if not found (do not include null values)
- If the page has no lab or people content, return {{}}
"""

MODEL = "anthropic/claude-3.5-haiku"


MEMBER_KEYWORDS = ["member", "people", "team", "group", "phd", "postdoc", "graduate",
                    "researcher", "professor", "staff", "alumni", "undergraduate"]


def build_prompt(markdown: str) -> str:
    """Build prompt by prioritizing sections with member content.

    The crawled markdown is multiple pages concatenated. We split on the repeated
    nav/header boundaries (each page starts with its own nav) and reorder so pages
    with member-related keywords come first, then the homepage for overview info.
    """
    # Split into pages — crawl4ai concatenates them with double newlines.
    # Each page typically re-includes the full nav, so look for that pattern.
    pages = markdown.split("\n\n\n")
    if len(pages) <= 1:
        pages = [markdown]

    # Score pages: higher = more member keywords
    def member_score(page: str) -> int:
        lower = page.lower()
        return sum(lower.count(kw) for kw in MEMBER_KEYWORDS)

    # Sort: member-rich pages first, then others (homepage for overview)
    scored = sorted(enumerate(pages), key=lambda x: member_score(x[1]), reverse=True)

    # Reassemble with member-heavy pages first, cap at 16000 words
    reordered = "\n\n".join(page for _, page in scored)
    words = reordered.split()
    truncated = " ".join(words[:16000])
    return f"Extract lab data from this page content:\n\n{truncated}"


def parse_llm_response(raw: str, slug: str = "") -> dict | None:
    try:
        text = raw.strip()
        # Strip markdown code fences
        if "```" in text:
            parts = text.split("```")
            # Take the first fenced block
            for part in parts[1:]:
                candidate = part.strip()
                if candidate.startswith("json"):
                    candidate = candidate[4:].strip()
                if candidate.startswith("{"):
                    text = candidate
                    break
        # If there's prose before the JSON, find the first { and last }
        if not text.startswith("{"):
            start = text.find("{")
            if start == -1:
                print(f"  DEBUG [{slug}]: No JSON object found in response")
                return None
            end = text.rfind("}")
            if end == -1:
                print(f"  DEBUG [{slug}]: No closing brace found")
                return None
            text = text[start : end + 1]
        data = json.loads(text)
        if not data:
            print(f"  DEBUG [{slug}]: LLM returned empty object/list")
            return None
        for member in data.get("members", []):
            for key in list(member.keys()):
                if member[key] is None:
                    del member[key]
        return data
    except Exception as e:
        print(f"  DEBUG [{slug}]: JSON parse failed: {e}")
        print(f"  DEBUG [{slug}]: Raw response (first 500 chars): {raw[:500]}")
        return None


async def extract_lab(client, slug: str, markdown: str) -> RawLab | None:
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_prompt(markdown)},
            ],
            temperature=0,
            max_tokens=8192,
        )
        raw = response.choices[0].message.content
        if not raw:
            print(f"  DEBUG [{slug}]: LLM returned null/empty content")
            return None
        data = parse_llm_response(raw, slug)
        if not data:
            return None
        return {
            "professor_slug": slug,
            "lab_url": "",  # filled in by stage 5 from faculty_with_urls.json
            "lab_name": data.get("lab_name", ""),
            "overview": data.get("overview", ""),
            "members": data.get("members", []),
        }
    except Exception as e:
        print(f"  LLM error for {slug}: {e}")
        return None


async def run() -> None:
    from openai import AsyncOpenAI
    from config import OPENROUTER_API_KEY, CRAWLED_DIR, LABS_RAW_FILE
    from verify import confirm

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

    print("Stage 4: Extracting structured data via LLM...")
    md_files = list(CRAWLED_DIR.glob("*.md"))
    print(f"  {len(md_files)} pages to extract")

    CONCURRENCY = 20
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results = []
    empty_count = 0

    async def bounded(f: Path):
        async with semaphore:
            return f.stem, await extract_lab(client, f.stem, f.read_text())

    tasks = [bounded(f) for f in md_files]
    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        slug, lab = await coro
        if lab:
            results.append(lab)
        else:
            empty_count += 1
            print(f"  ⚠️  Empty extraction: {slug}")
        if i % 20 == 0:
            print(f"  {i}/{len(md_files)} extracted...")

    print(f"\nExtracted successfully: {len(results)}")
    print(f"Empty/failed: {empty_count}")

    import random
    if results:
        samples = random.sample(results, min(5, len(results)))
        print("\nRandom samples:")
        for lab in samples:
            print(f"\n  {lab['lab_name']} ({len(lab['members'])} members)")
            print(f"  Overview: {lab['overview'][:120]}")

    estimated_cost = len(md_files) * 3000 * 0.25 / 1_000_000
    print(f"\nEstimated token cost: ~${estimated_cost:.4f}")

    if not confirm(f"Save {len(results)} extracted labs to data/labs_raw.json?"):
        print("Aborted.")
        return

    LABS_RAW_FILE.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved to {LABS_RAW_FILE}")
