# Lab Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-stage async Python pipeline in `scraper/` that produces a `labs.json` of UCSD CSE labs with members for the lab-emailer UI.

**Architecture:** Sequential stages that each read/write JSON to disk, allowing any stage to be rerun independently. Each stage ends with a verify step that prints a summary and waits for user confirmation before the next stage starts.

**Tech Stack:** Python 3.11+, crawl4ai, exa-py, openai SDK (OpenRouter), python-dotenv, httpx, pytest, pytest-asyncio

---

## File Map

| File | Responsibility |
|------|---------------|
| `scraper/pipeline.py` | CLI entrypoint, argparse, stage orchestration |
| `scraper/config.py` | Env var loading, file path constants |
| `scraper/models.py` | TypedDicts for Faculty, FacultyWithURL, RawLab, Member |
| `scraper/verify.py` | Shared `confirm(summary)` prompt utility |
| `scraper/stages/stage1_faculty.py` | Fetch faculty list from UCSD Profiles API |
| `scraper/stages/stage2_urls.py` | Exa search to find lab website per professor |
| `scraper/stages/stage3_crawl.py` | Crawl4AI async crawl of lab pages |
| `scraper/stages/stage4_extract.py` | OpenRouter LLM extraction to structured JSON |
| `scraper/stages/stage5_merge.py` | Transform labs_raw.json → final labs.json schema |
| `scraper/tests/test_stage1.py` | Unit tests for faculty normalization logic |
| `scraper/tests/test_stage2.py` | Unit tests for URL filtering logic |
| `scraper/tests/test_stage3.py` | Unit tests for crawl config and skip logic |
| `scraper/tests/test_stage4.py` | Unit tests for prompt building and response parsing |
| `scraper/tests/test_stage5.py` | Unit tests for merge/transform logic |
| `scraper/requirements.txt` | All Python dependencies |
| `scraper/.env.example` | Template for required env vars |
| `scraper/data/.gitkeep` | Keep data/ in git without committing scraped data |
| `scraper/data/crawled_pages/.gitkeep` | Keep crawled_pages/ in git |
| `scraper/output/.gitkeep` | Keep output/ in git |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `scraper/requirements.txt`
- Create: `scraper/.env.example`
- Create: `scraper/.gitignore`
- Create: `scraper/data/.gitkeep`
- Create: `scraper/data/crawled_pages/.gitkeep`
- Create: `scraper/output/.gitkeep`
- Create: `scraper/stages/__init__.py`
- Create: `scraper/tests/__init__.py`

- [ ] **Step 1: Create the scraper directory structure**

```bash
mkdir -p scraper/stages scraper/tests scraper/data/crawled_pages scraper/output
touch scraper/stages/__init__.py scraper/tests/__init__.py
touch scraper/data/.gitkeep scraper/data/crawled_pages/.gitkeep scraper/output/.gitkeep
```

- [ ] **Step 2: Write `scraper/requirements.txt`**

```
crawl4ai>=0.4.0
exa-py>=1.0.0
openai>=1.0.0
httpx>=0.27.0
python-dotenv>=1.0.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

- [ ] **Step 3: Write `scraper/.env.example`**

```
# Get from: browser DevTools on profiles.ucsd.edu/search/ → XHR headers → Authorization
UCSD_SSO_TOKEN=Bearer eyJ...

# Get from: https://dashboard.exa.ai
EXA_API_KEY=your_key_here

# Get from: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-...
```

- [ ] **Step 4: Write `scraper/.gitignore`**

```
.env
data/faculty.json
data/faculty_with_urls.json
data/crawled_pages/
data/labs_raw.json
output/labs.json
__pycache__/
.pytest_cache/
*.pyc
```

- [ ] **Step 5: Install dependencies and Playwright browsers**

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
```

Expected: installs without errors. `playwright install` downloads ~130MB Chromium binary.

- [ ] **Step 6: Commit**

```bash
git add scraper/
git commit -m "feat: scaffold scraper directory structure"
```

---

## Task 2: Config and Models

**Files:**
- Create: `scraper/config.py`
- Create: `scraper/models.py`

- [ ] **Step 1: Write `scraper/config.py`**

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

UCSD_SSO_TOKEN = os.environ["UCSD_SSO_TOKEN"]
EXA_API_KEY = os.environ["EXA_API_KEY"]
OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]

DATA_DIR = Path(__file__).parent / "data"
CRAWLED_DIR = DATA_DIR / "crawled_pages"
OUTPUT_DIR = Path(__file__).parent / "output"

FACULTY_FILE = DATA_DIR / "faculty.json"
FACULTY_URLS_FILE = DATA_DIR / "faculty_with_urls.json"
LABS_RAW_FILE = DATA_DIR / "labs_raw.json"
LABS_OUTPUT_FILE = OUTPUT_DIR / "labs.json"
```

- [ ] **Step 2: Write `scraper/models.py`**

```python
from typing import TypedDict, Optional

class Faculty(TypedDict):
    name: str
    department: str
    profile_url: str

class FacultyWithURL(TypedDict):
    name: str
    department: str
    profile_url: str
    lab_url: Optional[str]   # None if not found

class RawMember(TypedDict, total=False):
    name: str
    role: str       # PI | PhD | Postdoc | Masters | Undergrad | Staff
    email: str      # optional
    photo: str      # optional, URL

class RawLab(TypedDict):
    professor_slug: str
    lab_url: str
    lab_name: str
    overview: str
    members: list[RawMember]
```

- [ ] **Step 3: Commit**

```bash
git add scraper/config.py scraper/models.py
git commit -m "feat: add config and shared models for scraper"
```

---

## Task 3: Verify Utility

**Files:**
- Create: `scraper/verify.py`
- Create: `scraper/tests/test_verify.py`

- [ ] **Step 1: Write failing test**

```python
# scraper/tests/test_verify.py
from unittest.mock import patch
from verify import confirm

def test_confirm_yes_proceeds():
    with patch("builtins.input", return_value="y"):
        result = confirm("Found 300 records. Continue?")
    assert result is True

def test_confirm_no_aborts():
    with patch("builtins.input", return_value="n"):
        result = confirm("Found 300 records. Continue?")
    assert result is False

def test_confirm_prints_summary(capsys):
    with patch("builtins.input", return_value="y"):
        confirm("Found 300 records. Continue?")
    captured = capsys.readouterr()
    assert "Found 300 records" in captured.out
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd scraper
python -m pytest tests/test_verify.py -v
```

Expected: `ModuleNotFoundError: No module named 'verify'`

- [ ] **Step 3: Write `scraper/verify.py`**

```python
def confirm(summary: str) -> bool:
    print(f"\n{'='*50}")
    print(summary)
    print('='*50)
    answer = input("Continue? [y/n]: ").strip().lower()
    return answer == "y"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/test_verify.py -v
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/verify.py scraper/tests/test_verify.py
git commit -m "feat: add verify/confirm utility"
```

---

## Task 4: Discover the UCSD Profiles API Endpoint

This is a manual discovery step — the exact API URL and required headers are not documented publicly.

**Files:**
- Modify: `scraper/stages/stage1_faculty.py` (after discovery)

- [ ] **Step 1: Find the API endpoint**

1. Open `https://profiles.ucsd.edu/search/` in Chrome while logged into your UCSD account
2. Open DevTools → Network tab → filter by "Fetch/XHR"
3. In the search box on the page, type "computer science" or select CSE department
4. Watch the Network tab for a request that returns a list of people in JSON format
5. Right-click that request → Copy → Copy as cURL
6. Note: the URL, any query params (e.g. `dept`, `limit`, `offset`), and the `Authorization` or `Cookie` header value

- [ ] **Step 2: Test the endpoint in terminal**

Replace the placeholders below with what you found in Step 1:

```bash
curl -s "ENDPOINT_URL?PARAMS" \
  -H "Authorization: HEADER_VALUE" \
  | python3 -m json.tool | head -100
```

Expected: JSON array of faculty records. Note the field names for name, department, and profile URL — you'll need them in stage1_faculty.py.

- [ ] **Step 3: Note the field names**

Write them down — e.g. `displayName`, `department`, `profileUrl`. You'll reference these in Task 5.

---

## Task 5: Stage 1 — Faculty List

**Files:**
- Create: `scraper/stages/stage1_faculty.py`
- Create: `scraper/tests/test_stage1.py`

- [ ] **Step 1: Write failing tests**

```python
# scraper/tests/test_stage1.py
import pytest
from stages.stage1_faculty import normalize_faculty, is_valid_faculty

# Use the real field names you found in Task 4 discovery
# These examples assume fields: displayName, primaryAffiliation, profileUrl
# Adjust if your API uses different field names

SAMPLE_API_RESPONSE = [
    {"displayName": "Jane Smith", "primaryAffiliation": "Computer Science and Engineering", "profileUrl": "https://profiles.ucsd.edu/jane.smith"},
    {"displayName": "Bob Jones", "primaryAffiliation": "Computer Science and Engineering", "profileUrl": "https://profiles.ucsd.edu/bob.jones"},
    {"displayName": "", "primaryAffiliation": "Computer Science and Engineering", "profileUrl": ""},  # invalid: empty name
]

def test_normalize_faculty_extracts_fields():
    result = normalize_faculty(SAMPLE_API_RESPONSE[0])
    assert result["name"] == "Jane Smith"
    assert result["department"] == "Computer Science and Engineering"
    assert result["profile_url"] == "https://profiles.ucsd.edu/jane.smith"

def test_is_valid_faculty_rejects_empty_name():
    assert is_valid_faculty({"name": "", "department": "CSE", "profile_url": "https://..."}) is False

def test_is_valid_faculty_rejects_empty_url():
    assert is_valid_faculty({"name": "Jane", "department": "CSE", "profile_url": ""}) is False

def test_is_valid_faculty_accepts_complete_record():
    assert is_valid_faculty({"name": "Jane", "department": "CSE", "profile_url": "https://profiles.ucsd.edu/jane"}) is True

def test_normalize_faculty_batch_filters_invalid():
    from stages.stage1_faculty import normalize_batch
    results = normalize_batch(SAMPLE_API_RESPONSE)
    assert len(results) == 2  # third record filtered out
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_stage1.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write `scraper/stages/stage1_faculty.py`**

Replace `displayName`, `primaryAffiliation`, `profileUrl` with the actual field names from your Task 4 discovery.

```python
import json
import asyncio
import httpx
from models import Faculty
from config import UCSD_SSO_TOKEN, FACULTY_FILE
from verify import confirm

# ── adjust these to match what you found in Task 4 ──
API_URL = "https://profiles.ucsd.edu/search/api"   # replace with real endpoint
DEPT_FILTER = "Computer Science and Engineering"    # replace with real dept value
NAME_FIELD = "displayName"
DEPT_FIELD = "primaryAffiliation"
URL_FIELD = "profileUrl"
# ─────────────────────────────────────────────────────

def normalize_faculty(raw: dict) -> Faculty:
    return {
        "name": raw.get(NAME_FIELD, "").strip(),
        "department": raw.get(DEPT_FIELD, "").strip(),
        "profile_url": raw.get(URL_FIELD, "").strip(),
    }

def is_valid_faculty(f: Faculty) -> bool:
    return bool(f["name"] and f["profile_url"])

def normalize_batch(raw_list: list[dict]) -> list[Faculty]:
    return [f for f in (normalize_faculty(r) for r in raw_list) if is_valid_faculty(f)]

async def fetch_faculty() -> list[Faculty]:
    headers = {"Authorization": UCSD_SSO_TOKEN}
    params = {"dept": DEPT_FILTER, "limit": 500}  # adjust params to match real API
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(API_URL, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
    # API may return list directly or nested under a key — adjust as needed
    raw_list = data if isinstance(data, list) else data.get("results", data.get("profiles", []))
    return normalize_batch(raw_list)

def print_verify_summary(faculty: list[Faculty]):
    import random
    print(f"\nTotal faculty fetched: {len(faculty)}")
    if len(faculty) < 100:
        print("  ⚠️  WARNING: fewer than 100 results — check dept filter or token")
    samples = random.sample(faculty, min(5, len(faculty)))
    print("\nRandom sample:")
    for f in samples:
        print(f"  {f['name']} — {f['profile_url']}")
    missing = [f for f in faculty if not f["profile_url"]]
    print(f"\nRecords with missing profile_url: {len(missing)}")

async def run():
    print("Stage 1: Fetching faculty list from UCSD Profiles API...")
    try:
        faculty = await fetch_faculty()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            print("❌ 401 Unauthorized — your UCSD_SSO_TOKEN is expired.")
            print("   Refresh: log into profiles.ucsd.edu, open DevTools > Network,")
            print("   find any API request, copy the Authorization header value,")
            print("   and update .env")
        raise

    print_verify_summary(faculty)

    if not confirm(f"Save {len(faculty)} faculty records to data/faculty.json?"):
        print("Aborted.")
        return

    FACULTY_FILE.parent.mkdir(parents=True, exist_ok=True)
    FACULTY_FILE.write_text(json.dumps(faculty, indent=2))
    print(f"✅ Saved to {FACULTY_FILE}")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_stage1.py -v
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/stages/stage1_faculty.py scraper/tests/test_stage1.py
git commit -m "feat: stage 1 - fetch UCSD faculty list"
```

---

## Task 6: Stage 2 — Find Lab URLs

**Files:**
- Create: `scraper/stages/stage2_urls.py`
- Create: `scraper/tests/test_stage2.py`

- [ ] **Step 1: Write failing tests**

```python
# scraper/tests/test_stage2.py
import pytest
from stages.stage2_urls import is_bad_url, build_query

def test_is_bad_url_rejects_linkedin():
    assert is_bad_url("https://linkedin.com/in/samsmith") is True

def test_is_bad_url_rejects_scholar():
    assert is_bad_url("https://scholar.google.com/citations?user=abc") is True

def test_is_bad_url_rejects_twitter():
    assert is_bad_url("https://twitter.com/samsmith") is True

def test_is_bad_url_rejects_ratemyprofessor():
    assert is_bad_url("https://www.ratemyprofessors.com/professor/123") is True

def test_is_bad_url_rejects_ucsd_profiles():
    # we already have the profile URL; skip it as lab URL
    assert is_bad_url("https://profiles.ucsd.edu/sam.smith") is True

def test_is_bad_url_accepts_lab_website():
    assert is_bad_url("https://ai-lab.ucsd.edu") is False

def test_is_bad_url_accepts_personal_site():
    assert is_bad_url("https://samsmith.github.io") is False

def test_build_query():
    q = build_query("Sam Lau")
    assert "Sam Lau" in q
    assert "UCSD" in q
    assert "research" in q.lower() or "lab" in q.lower()
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_stage2.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write `scraper/stages/stage2_urls.py`**

```python
import json
import asyncio
from exa_py import Exa
from models import Faculty, FacultyWithURL
from config import EXA_API_KEY, FACULTY_FILE, FACULTY_URLS_FILE
from verify import confirm

BAD_URL_PATTERNS = [
    "linkedin.com",
    "scholar.google.com",
    "twitter.com",
    "x.com",
    "ratemyprofessors.com",
    "profiles.ucsd.edu",
    "researchgate.net",
    "facebook.com",
]

def is_bad_url(url: str) -> bool:
    return any(pattern in url for pattern in BAD_URL_PATTERNS)

def build_query(name: str) -> str:
    return f"{name} UCSD CSE professor research lab website"

async def find_url_for_professor(exa: Exa, faculty: Faculty) -> FacultyWithURL:
    try:
        results = exa.search(build_query(faculty["name"]), num_results=5)
        for r in results.results:
            if r.url and not is_bad_url(r.url):
                return {**faculty, "lab_url": r.url}
    except Exception as e:
        print(f"  Exa error for {faculty['name']}: {e}")
    return {**faculty, "lab_url": None}

async def run():
    print("Stage 2: Finding lab URLs via Exa...")
    faculty: list[Faculty] = json.loads(FACULTY_FILE.read_text())
    exa = Exa(api_key=EXA_API_KEY)

    CONCURRENCY = 10
    results: list[FacultyWithURL] = []
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async def bounded(f):
        async with semaphore:
            return await find_url_for_professor(exa, f)

    tasks = [bounded(f) for f in faculty]
    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        result = await coro
        results.append(result)
        if i % 20 == 0:
            print(f"  {i}/{len(faculty)} done...")

    found = [r for r in results if r["lab_url"]]
    missing = [r for r in results if not r["lab_url"]]

    print(f"\nFound URL: {len(found)}")
    print(f"No URL found: {len(missing)}")

    import random
    samples = random.sample(found, min(10, len(found)))
    print("\nRandom sample (name → URL):")
    for r in samples:
        print(f"  {r['name']} → {r['lab_url']}")

    if missing:
        print(f"\nMissing URLs ({len(missing)}) — edit faculty_with_urls.json manually to add:")
        for r in missing:
            print(f"  {r['name']}")

    if not confirm(f"Save results to data/faculty_with_urls.json?"):
        print("Aborted.")
        return

    FACULTY_URLS_FILE.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved to {FACULTY_URLS_FILE}")
    print("   You can edit this file to fix any incorrect or missing URLs before running stage 3.")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_stage2.py -v
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/stages/stage2_urls.py scraper/tests/test_stage2.py
git commit -m "feat: stage 2 - find lab URLs via Exa search"
```

---

## Task 7: Stage 3 — Crawl Lab Pages

**Files:**
- Create: `scraper/stages/stage3_crawl.py`
- Create: `scraper/tests/test_stage3.py`

- [ ] **Step 1: Write failing tests**

```python
# scraper/tests/test_stage3.py
from stages.stage3_crawl import should_follow_url, has_people_content, make_slug

def test_should_follow_url_allows_people():
    assert should_follow_url("https://lab.ucsd.edu/people") is True

def test_should_follow_url_allows_team():
    assert should_follow_url("https://lab.ucsd.edu/team") is True

def test_should_follow_url_allows_members():
    assert should_follow_url("https://lab.ucsd.edu/members") is True

def test_should_follow_url_allows_about():
    assert should_follow_url("https://lab.ucsd.edu/about") is True

def test_should_follow_url_allows_research():
    assert should_follow_url("https://lab.ucsd.edu/research") is True

def test_should_follow_url_blocks_blog():
    assert should_follow_url("https://lab.ucsd.edu/blog/post-1") is False

def test_should_follow_url_blocks_publications():
    assert should_follow_url("https://lab.ucsd.edu/publications") is False

def test_should_follow_url_blocks_news():
    assert should_follow_url("https://lab.ucsd.edu/news/2024") is False

def test_has_people_content_detects_role_keywords():
    md = "## Lab Members\nJane Smith, PhD student\nBob Jones, Postdoc"
    assert has_people_content(md) is True

def test_has_people_content_false_for_empty_page():
    assert has_people_content("Welcome to our lab. We do research.") is False

def test_make_slug():
    assert make_slug("AI Systems Lab") == "ai-systems-lab"
    assert make_slug("Dr. Smith's Lab!") == "dr-smiths-lab"
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_stage3.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write `scraper/stages/stage3_crawl.py`**

```python
import json
import asyncio
import re
from pathlib import Path
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
from models import FacultyWithURL
from config import FACULTY_URLS_FILE, CRAWLED_DIR
from verify import confirm

ALLOWED_URL_KEYWORDS = ["people", "team", "members", "lab", "about", "research"]
BLOCKED_URL_KEYWORDS = ["blog", "news", "publication", "paper", "seminar", "event", "course", "class", "cv"]
PEOPLE_ROLE_KEYWORDS = ["phd", "postdoc", "graduate student", "researcher", "professor", "faculty", "undergraduate"]
MAX_PAGES_PER_DOMAIN = 3
PAGE_TIMEOUT = 15000  # ms

def make_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug.strip())
    return slug

def should_follow_url(url: str) -> bool:
    path = url.lower().split("?")[0]
    if any(kw in path for kw in BLOCKED_URL_KEYWORDS):
        return False
    return any(kw in path for kw in ALLOWED_URL_KEYWORDS)

def has_people_content(markdown: str) -> bool:
    lower = markdown.lower()
    return any(kw in lower for kw in PEOPLE_ROLE_KEYWORDS)

async def crawl_lab(crawler: AsyncWebCrawler, faculty: FacultyWithURL) -> tuple[str, str]:
    """Returns (slug, combined_markdown). Crawls homepage + up to 2 subpages."""
    slug = make_slug(faculty["name"])
    url = faculty["lab_url"]
    combined_md = []

    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=PAGE_TIMEOUT,
    )

    # Crawl homepage
    result = await crawler.arun(url, config=config)
    if not result.success:
        return slug, ""
    combined_md.append(result.markdown or "")

    # Early stop if homepage already has people content
    if has_people_content(result.markdown or ""):
        return slug, "\n\n".join(combined_md)

    # Find subpage links
    links = [
        l["href"] for l in (result.links.get("internal", []) or [])
        if l.get("href") and should_follow_url(l["href"])
    ][:MAX_PAGES_PER_DOMAIN - 1]

    for link in links:
        sub = await crawler.arun(link, config=config)
        if sub.success and sub.markdown:
            combined_md.append(sub.markdown)

    return slug, "\n\n".join(combined_md)

async def run():
    print("Stage 3: Crawling lab pages...")
    faculty_list: list[FacultyWithURL] = json.loads(FACULTY_URLS_FILE.read_text())
    to_crawl = [f for f in faculty_list if f.get("lab_url")]
    skipped = len(faculty_list) - len(to_crawl)
    print(f"  {len(to_crawl)} labs to crawl, {skipped} skipped (no URL)")

    CRAWLED_DIR.mkdir(parents=True, exist_ok=True)
    success, failed = 0, 0
    lengths = []

    CONCURRENCY = 5
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with AsyncWebCrawler() as crawler:
        async def bounded_crawl(f):
            async with semaphore:
                return await crawl_lab(crawler, f)

        tasks = [bounded_crawl(f) for f in to_crawl]
        results = []
        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            slug, md = await coro
            results.append((slug, md))
            if md:
                success += 1
                lengths.append(len(md))
                (CRAWLED_DIR / f"{slug}.md").write_text(md)
            else:
                failed += 1
            if i % 20 == 0:
                print(f"  {i}/{len(to_crawl)} crawled...")

    avg_len = int(sum(lengths) / len(lengths)) if lengths else 0
    print(f"\nSuccessfully crawled: {success}")
    print(f"Failed/empty: {failed}")
    print(f"Average markdown length: {avg_len} chars")

    short = [(slug, md) for slug, md in results if 0 < len(md) < 200]
    if short:
        print(f"\n⚠️  {len(short)} pages suspiciously short (<200 chars) — likely broken pages:")
        for slug, _ in short:
            print(f"  {slug}")

    import random
    samples = random.sample([(s, m) for s, m in results if m], min(3, success))
    print("\nRandom samples (first 300 chars):")
    for slug, md in samples:
        print(f"\n--- {slug} ---\n{md[:300]}")

    if not confirm(f"Crawl complete. Proceed with {success} pages?"):
        print("Aborted.")
        return

    print(f"✅ Crawled pages saved to {CRAWLED_DIR}")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_stage3.py -v
```

Expected: all 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/stages/stage3_crawl.py scraper/tests/test_stage3.py
git commit -m "feat: stage 3 - async crawl lab pages with depth limiting"
```

---

## Task 8: Stage 4 — LLM Extraction

**Files:**
- Create: `scraper/stages/stage4_extract.py`
- Create: `scraper/tests/test_stage4.py`

- [ ] **Step 1: Write failing tests**

```python
# scraper/tests/test_stage4.py
import pytest
from stages.stage4_extract import parse_llm_response, build_prompt, EXTRACTION_SCHEMA

def test_parse_valid_json():
    raw = '{"lab_name": "AI Lab", "overview": "We do AI.", "members": [{"name": "Jane", "role": "PI"}]}'
    result = parse_llm_response(raw)
    assert result["lab_name"] == "AI Lab"
    assert result["members"][0]["role"] == "PI"

def test_parse_returns_none_for_empty_object():
    assert parse_llm_response("{}") is None

def test_parse_returns_none_for_invalid_json():
    assert parse_llm_response("not json at all") is None

def test_parse_strips_optional_null_fields():
    raw = '{"lab_name": "AI Lab", "overview": "We do AI.", "members": [{"name": "Jane", "role": "PhD", "email": null, "photo": null}]}'
    result = parse_llm_response(raw)
    member = result["members"][0]
    assert "email" not in member
    assert "photo" not in member

def test_build_prompt_includes_markdown():
    prompt = build_prompt("# Lab\nJane Smith, PhD")
    assert "Jane Smith" in prompt

def test_extraction_schema_has_required_fields():
    assert "lab_name" in EXTRACTION_SCHEMA
    assert "overview" in EXTRACTION_SCHEMA
    assert "members" in EXTRACTION_SCHEMA
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_stage4.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write `scraper/stages/stage4_extract.py`**

```python
import json
import asyncio
from pathlib import Path
from openai import AsyncOpenAI
from config import OPENROUTER_API_KEY, CRAWLED_DIR, LABS_RAW_FILE
from models import RawLab
from verify import confirm

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

MODEL = "anthropic/claude-haiku-3-5"

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

def build_prompt(markdown: str) -> str:
    # Truncate to ~6000 words to stay within token budget
    words = markdown.split()
    truncated = " ".join(words[:6000])
    return f"Extract lab data from this page content:\n\n{truncated}"

def parse_llm_response(raw: str) -> dict | None:
    try:
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())
        if not data:
            return None
        # Strip null/None values from member fields
        for member in data.get("members", []):
            for key in list(member.keys()):
                if member[key] is None:
                    del member[key]
        return data
    except (json.JSONDecodeError, Exception):
        return None

async def extract_lab(slug: str, markdown: str) -> RawLab | None:
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
            "lab_url": "",  # filled in by merge stage from faculty_with_urls.json
            "lab_name": data.get("lab_name", ""),
            "overview": data.get("overview", ""),
            "members": data.get("members", []),
        }
    except Exception as e:
        print(f"  LLM error for {slug}: {e}")
        return None

async def run():
    print("Stage 4: Extracting structured data via LLM...")
    md_files = list(CRAWLED_DIR.glob("*.md"))
    print(f"  {len(md_files)} pages to extract")

    CONCURRENCY = 5
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results = []
    empty_count = 0

    async def bounded(f: Path):
        async with semaphore:
            return f.stem, await extract_lab(f.stem, f.read_text())

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
    samples = random.sample(results, min(5, len(results)))
    print("\nRandom samples:")
    for lab in samples:
        print(f"\n  {lab['lab_name']} ({len(lab['members'])} members)")
        print(f"  Overview: {lab['overview'][:120]}")

    # Rough token cost estimate: ~3K tokens per page * len * $0.25/1M
    estimated_cost = len(md_files) * 3000 * 0.25 / 1_000_000
    print(f"\nEstimated token cost: ~${estimated_cost:.2f}")

    if not confirm(f"Save {len(results)} extracted labs to data/labs_raw.json?"):
        print("Aborted.")
        return

    LABS_RAW_FILE.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved to {LABS_RAW_FILE}")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_stage4.py -v
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/stages/stage4_extract.py scraper/tests/test_stage4.py
git commit -m "feat: stage 4 - LLM extraction via OpenRouter"
```

---

## Task 9: Stage 5 — Merge to Final Schema

**Files:**
- Create: `scraper/stages/stage5_merge.py`
- Create: `scraper/tests/test_stage5.py`

- [ ] **Step 1: Write failing tests**

```python
# scraper/tests/test_stage5.py
from stages.stage5_merge import make_slug, build_member, build_lab, build_output

RAW_LAB = {
    "professor_slug": "jane-smith",
    "lab_url": "https://ailab.ucsd.edu",
    "lab_name": "AI Systems Lab",
    "overview": "We study AI systems.",
    "members": [
        {"name": "Dr. Jane Smith", "role": "PI", "email": "jsmith@ucsd.edu", "photo": "https://ailab.ucsd.edu/jane.jpg"},
        {"name": "Bob Jones", "role": "PhD"},
    ],
}

def test_make_slug():
    assert make_slug("AI Systems Lab") == "ai-systems-lab"

def test_build_member_includes_optional_fields():
    m = build_member({"name": "Jane Smith", "role": "PI", "email": "j@ucsd.edu", "photo": "https://x.com/p.jpg"})
    assert m["email"] == "j@ucsd.edu"
    assert m["photo"] == "https://x.com/p.jpg"

def test_build_member_omits_missing_optional_fields():
    m = build_member({"name": "Bob", "role": "PhD"})
    assert "email" not in m
    assert "photo" not in m

def test_build_lab_shape():
    lab = build_lab(RAW_LAB)
    assert lab["id"] == "ai-systems-lab"
    assert lab["name"] == "AI Systems Lab"
    assert lab["website"] == "https://ailab.ucsd.edu"
    assert lab["overview"] == "We study AI systems."
    assert len(lab["members"]) == 2

def test_build_output_wraps_in_departments():
    output = build_output([RAW_LAB])
    assert output["departments"][0]["id"] == "cse"
    assert len(output["departments"][0]["labs"]) == 1

def test_build_output_skips_labs_with_no_name():
    no_name = {**RAW_LAB, "lab_name": ""}
    output = build_output([no_name])
    assert len(output["departments"][0]["labs"]) == 0
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_stage5.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write `scraper/stages/stage5_merge.py`**

```python
import json
import re
from models import RawLab
from config import LABS_RAW_FILE, FACULTY_URLS_FILE, LABS_OUTPUT_FILE
from verify import confirm

def make_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug.strip())
    return slug

def build_member(raw: dict) -> dict:
    m = {
        "id": make_slug(raw["name"]),
        "name": raw["name"],
        "role": raw["role"],
    }
    if raw.get("email"):
        m["email"] = raw["email"]
    if raw.get("photo"):
        m["photo"] = raw["photo"]
    return m

def build_lab(raw: RawLab) -> dict:
    return {
        "id": make_slug(raw["lab_name"]),
        "name": raw["lab_name"],
        "website": raw["lab_url"],
        "overview": raw["overview"],
        "members": [build_member(m) for m in raw["members"]],
    }

def build_output(raw_labs: list[RawLab]) -> dict:
    labs = [build_lab(r) for r in raw_labs if r.get("lab_name")]
    return {
        "departments": [
            {
                "id": "cse",
                "name": "Computer Science & Engineering",
                "labs": labs,
            }
        ]
    }

async def run():
    print("Stage 5: Merging to final labs.json...")
    raw_labs: list[RawLab] = json.loads(LABS_RAW_FILE.read_text())

    # Attach lab_url from faculty_with_urls.json (stage 4 doesn't have it)
    url_map = {
        make_slug(f["name"]): f["lab_url"]
        for f in json.loads(FACULTY_URLS_FILE.read_text())
        if f.get("lab_url")
    }
    for lab in raw_labs:
        if not lab.get("lab_url"):
            lab["lab_url"] = url_map.get(lab["professor_slug"], "")

    output = build_output(raw_labs)
    total_labs = len(output["departments"][0]["labs"])
    total_members = sum(len(l["members"]) for l in output["departments"][0]["labs"])
    zero_member_labs = [l["name"] for l in output["departments"][0]["labs"] if len(l["members"]) == 0]

    print(f"\nTotal labs: {total_labs}")
    print(f"Total members: {total_members}")
    if zero_member_labs:
        print(f"\n⚠️  Labs with 0 members ({len(zero_member_labs)}) — extraction may have failed:")
        for name in zero_member_labs[:10]:
            print(f"  {name}")

    if not confirm(f"Write final labs.json with {total_labs} labs and {total_members} members?"):
        print("Aborted.")
        return

    LABS_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    LABS_OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"✅ Saved to {LABS_OUTPUT_FILE}")
    print(f"\nTo use in the UI: cp {LABS_OUTPUT_FILE} ../src/data/labs.json")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_stage5.py -v
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/stages/stage5_merge.py scraper/tests/test_stage5.py
git commit -m "feat: stage 5 - merge to final labs.json schema"
```

---

## Task 10: Pipeline Entrypoint

**Files:**
- Create: `scraper/pipeline.py`

- [ ] **Step 1: Write `scraper/pipeline.py`**

```python
import asyncio
import argparse
import sys
from stages import stage1_faculty, stage2_urls, stage3_crawl, stage4_extract, stage5_merge

STAGES = {
    "stage1": stage1_faculty.run,
    "stage2": stage2_urls.run,
    "stage3": stage3_crawl.run,
    "stage4": stage4_extract.run,
    "stage5": stage5_merge.run,
}

async def run_all():
    for name, fn in STAGES.items():
        print(f"\n{'#'*50}")
        print(f"# {name.upper()}")
        print(f"{'#'*50}")
        await fn()

def main():
    parser = argparse.ArgumentParser(description="UCSD Lab scraper pipeline")
    parser.add_argument(
        "stage",
        choices=list(STAGES.keys()) + ["all"],
        help="Which stage to run, or 'all' to run everything"
    )
    args = parser.parse_args()

    if args.stage == "all":
        asyncio.run(run_all())
    else:
        asyncio.run(STAGES[args.stage]())

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run a quick smoke test**

```bash
cd scraper
python pipeline.py --help
```

Expected: shows usage with `stage1 stage2 stage3 stage4 stage5 all` as choices, no errors.

- [ ] **Step 3: Run all unit tests**

```bash
python -m pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add scraper/pipeline.py
git commit -m "feat: add pipeline entrypoint for lab scraper"
```

---

## Task 11: End-to-End Test Run

This is a manual run to verify the full pipeline works with real data.

- [ ] **Step 1: Set up your .env**

```bash
cd scraper
cp .env.example .env
# Edit .env and fill in UCSD_SSO_TOKEN, EXA_API_KEY, OPENROUTER_API_KEY
```

- [ ] **Step 2: Run stage 1 and verify count**

```bash
python pipeline.py stage1
```

Expected: ~300–400 CSE faculty. If fewer than 100, check token and dept filter in `stage1_faculty.py`.

- [ ] **Step 3: Run stage 2 on a small batch first**

Temporarily edit `stage2_urls.py` to slice the list to 10 entries (`faculty[:10]`), run it, check the 10 URLs printed look correct, then remove the slice.

```bash
python pipeline.py stage2
```

- [ ] **Step 4: Run stage 3 on a small batch first**

Temporarily slice `faculty_with_urls.json` to 5 entries (copy to a temp file, reduce the list), run crawl, check the output markdown files look reasonable. Then restore and run on all.

```bash
python pipeline.py stage3
```

- [ ] **Step 5: Run stages 4 and 5**

```bash
python pipeline.py stage4
python pipeline.py stage5
```

- [ ] **Step 6: Copy output to UI**

```bash
cp output/labs.json ../src/data/labs.json
```

- [ ] **Step 7: Final commit**

```bash
git add -p  # stage only config/discovery changes, not scraped data
git commit -m "feat: complete lab scraper pipeline"
```
