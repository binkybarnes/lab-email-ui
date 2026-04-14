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

MODEL = "anthropic/claude-haiku-3-5"


def build_prompt(markdown: str) -> str:
    words = markdown.split()
    truncated = " ".join(words[:6000])
    return f"Extract lab data from this page content:\n\n{truncated}"


def parse_llm_response(raw: str) -> dict | None:
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())
        if not data:
            return None
        for member in data.get("members", []):
            for key in list(member.keys()):
                if member[key] is None:
                    del member[key]
        return data
    except Exception:
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
        )
        raw = response.choices[0].message.content
        data = parse_llm_response(raw)
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

    CONCURRENCY = 5
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
    print(f"\nEstimated token cost: ~${estimated_cost:.2f}")

    if not confirm(f"Save {len(results)} extracted labs to data/labs_raw.json?"):
        print("Aborted.")
        return

    LABS_RAW_FILE.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved to {LABS_RAW_FILE}")
