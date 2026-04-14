import asyncio
from pathlib import Path
from openai import AsyncOpenAI
import json
from config import OPENROUTER_API_KEY, CRAWLED_DIR

SYSTEM_PROMPT = """You extract structured lab data from academic lab website content.

Output ONLY a JSON object matching this schema:
{"lab_name": "string", "overview": "string", "members": [{"name": "string", "role": "string"}]}

Rules:
- Only include people explicitly listed on the page. Do not invent names.
- Output ONLY valid JSON, no markdown blocks.
- If the page has no lab or people content, return {}
"""

async def main():
    client = AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=OPENROUTER_API_KEY)
    f = CRAWLED_DIR / "shankar-subramaniam.md"
    content = f.read_text()
    truncated = " ".join(content.split()[:6000])
    print(f"Testing {f.name}...")
    response = await client.chat.completions.create(
        model="anthropic/claude-3.5-haiku",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Extract lab data from this page content:\n\n{truncated}"}
        ],
        temperature=0
    )
    raw = response.choices[0].message.content
    print("RAW RESPONSE:")
    print(raw)

asyncio.run(main())
