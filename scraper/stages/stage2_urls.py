import json
import asyncio
import re
import aiohttp
from urllib.parse import urljoin
from openai import AsyncOpenAI
from models import Faculty, FacultyWithURL
from config import BRAVE_API_KEY, OPENROUTER_API_KEY

BAD_URL_PATTERNS = [
    "linkedin.com",
    "scholar.google.com",
    "twitter.com",
    "x.com",
    "ratemyprofessors.com",
    "profiles.ucsd.edu",
    "directory.ucsd.edu",
    "blink.ucsd.edu",
    "act.ucsd.edu",
    "m.ucsd.edu",
    "researcherprofiles.org",
    "researchgate.net",
    "facebook.com",
    "grantome.com",
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "nih.gov",
    "projectreporter.nih.gov",
    "dimensions.ai",
    "sciencedirect.com",
    "nature.com",
    "springer.com",
    "wiley.com",
    "wikipedia.org"
]

total_cost = 0.0
brave_requests = 0
BRAVE_COST_PER_1000 = 5.0

def is_bad_url(url: str) -> bool:
    return any(pattern in url for pattern in BAD_URL_PATTERNS)

# Matches anchor tags: href + inner HTML.
_ANCHOR_RE = re.compile(
    r'<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)

# Explicit lab-link phrases (always trusted regardless of domain).
_LAB_LINK_TEXT_RE = re.compile(
    r'(?:lab\s*website|research\s*(?:lab|group)\s*(?:website|page|homepage)?'
    r'|group\s*(?:website|page|homepage)|our\s*lab)',
    re.IGNORECASE,
)

# Generic "website" / "homepage" label — only trusted when the link is external.
_GENERIC_WEBSITE_RE = re.compile(
    r'^(?:website|homepage|personal\s*(?:website|page))$',
    re.IGNORECASE,
)

# Words that look like first names but aren't (stop words for competing-name detection).
_NAME_STOPWORDS = frozenset({
    "the", "a", "an", "of", "at", "in", "for", "dr", "prof", "and", "or",
    "lab", "labs", "group", "research", "institute", "center", "department",
})


async def resolve_lab_url(session: aiohttp.ClientSession, url: str, name: str = "") -> str:
    """Fetch a profile page and look for a link to the professor's actual lab website.

    Matching rules (permissive — certainty is determined later by verify_lab_url):
    1. Explicit phrases like "Lab Website", "Research Group Website"
    2. Last name + "research" or "lab" in the anchor text
    3. A standalone "Website" / "Homepage" pointing to a different domain
    """
    from urllib.parse import urlparse
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10), allow_redirects=True) as resp:
            if resp.status != 200:
                return url
            html = await resp.text(errors="replace")
    except Exception:
        return url

    base_domain = urlparse(url).netloc.lower()
    name_parts = name.lower().split()
    last_name = name_parts[-1] if len(name_parts) >= 2 else ""

    for m in _ANCHOR_RE.finditer(html):
        href, inner_html = m.group(1), m.group(2)
        visible = re.sub(r'<[^>]+>', '', inner_html).strip()
        if not visible or not href:
            continue

        resolved = urljoin(url, href)
        if is_bad_url(resolved):
            continue

        lower_vis = visible.lower()

        # 1. Explicit lab-link phrase
        if _LAB_LINK_TEXT_RE.search(visible):
            print(f"  🔗 Resolved profile → lab: {url} → {resolved}  (matched: {visible!r})")
            return resolved

        # 2. Last name + "research" or "lab" in anchor text (no length restriction —
        #    certainty is checked on the actual lab page later)
        if last_name and last_name in lower_vis and ("research" in lower_vis or "lab" in lower_vis):
            print(f"  🔗 Resolved profile → lab: {url} → {resolved}  (matched: {visible!r})")
            return resolved

        # 3. Standalone "Website" / "Homepage" pointing to a different domain
        if _GENERIC_WEBSITE_RE.match(visible):
            link_domain = urlparse(resolved).netloc.lower()
            if link_domain and link_domain != base_domain:
                print(f"  🔗 Resolved profile → lab: {url} → {resolved}  (matched: {visible!r})")
                return resolved

    return url


async def verify_lab_url(session: aiohttp.ClientSession, url: str, name: str) -> tuple[bool, str]:
    """Fetch the lab page and determine if it belongs to the given professor.

    Returns (certain: bool, reason: str).
    - certain=True, reason=""  → name found, looks right
    - certain=False, reason=… → uncertain, reason explains why

    Logic:
    - Full name (first + last) on page → certain
    - Last name on page, no competing first name → certain
      ("Subramaniam Research" page with no other first-name clue)
    - Last name on page, but a DIFFERENT first name precedes it → uncertain
      (changlab has "Eric Chang", Geoffrey Chang is looking → uncertain)
    - Last name not on page → uncertain
    """
    name_parts = name.lower().split()
    if len(name_parts) < 2:
        return (True, "")  # can't validate a single-word name

    first = name_parts[0]
    last = name_parts[-1]

    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10), allow_redirects=True) as resp:
            if resp.status != 200:
                return (False, f"page returned HTTP {resp.status}")
            html = await resp.text(errors="replace")
    except Exception as e:
        return (False, f"could not fetch page: {e}")

    # Strip tags for text search
    text = re.sub(r'<[^>]+>', ' ', html).lower()
    text = re.sub(r'\s+', ' ', text)

    if last not in text:
        return (False, f"professor last name '{last}' not found on page")

    if first in text:
        return (True, "")

    # Last name found but first name not — check for a competing first name:
    # find all "{word} {last}" occurrences where {word} looks like a first name.
    competing = []
    for m in re.finditer(rf'\b([a-z]{{2,15}})\s+{re.escape(last)}\b', text):
        word = m.group(1)
        if word not in _NAME_STOPWORDS and word != last:
            competing.append(word)

    if competing:
        other = competing[0]
        return (
            False,
            f"page has '{other} {last}' but looking for '{first} {last}' — may be a different person",
        )

    # Last name present, no competing first name → treat as certain
    return (True, "")

    return url

_PROFILE_PATH_PATTERNS = re.compile(
    r'/(?:user|users|faculty|profile|profiles|directory|people|staff|content|about|bio)/'
    r'[^/]+/?$',
    re.IGNORECASE,
)

def is_profile_url(url: str) -> bool:
    """Detect obvious profile/directory page URLs by path pattern."""
    from urllib.parse import urlparse
    path = urlparse(url).path
    return bool(_PROFILE_PATH_PATTERNS.search(path))

def build_query(name: str, department: str) -> str:
    return f"{name} UCSD research lab website"

async def select_best_url_llm(faculty: Faculty, candidates: list[dict]) -> str | None:
    """Use an LLM to select the most likely standalone lab website from search results."""
    global total_cost
    if not candidates:
        return None
        
    client = AsyncOpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1"
    )
    
    # Pre-process candidates — tag profile URLs so the LLM can't misjudge them
    has_profile_resolved = any(c.get("profile_resolved") for c in candidates)
    candidate_list = ""
    for i, c in enumerate(candidates, 1):
        if c.get("profile_resolved"):
            tag = " ✅ LINKED FROM PROFILE"
        elif is_profile_url(c['url']):
            tag = " ⚠️ PROFILE PAGE"
        else:
            tag = ""
        candidate_list += f"{i}. Title: {c['title']}\n   URL: {c['url']}{tag}\n   Description: {c['snippet']}\n\n"

    profile_resolved_note = ""
    if has_profile_resolved:
        profile_resolved_note = """
IMPORTANT: One or more results are tagged "✅ LINKED FROM PROFILE". These URLs were found by
following an explicit lab link on the professor's department profile page — they have the
highest prior probability of being correct. ALWAYS prefer a LINKED FROM PROFILE result over
any other candidate unless it is obviously wrong (wrong person's name in URL, social media, etc).

"""

    prompt = f"""
Pick the OFFICIAL RESEARCH LAB WEBSITE for {faculty['name']} at UCSD ({faculty['department']}).

A lab website is a STANDALONE site owned by the research group — it has its OWN domain or subdomain
(e.g. messer-lab.ucsd.edu, genome.ucsd.edu, smithlab.org) and its own navigation with pages like
People, Research, Publications, Join Us.

PROFILE PAGES ARE NOT LAB WEBSITES. Any URL with a path like /user/name, /faculty/name,
/profile/name, /directory/name, /content/name, /people/name, or /bio/name is a profile page.
Profile pages are hosted on someone else's site (a department, a center, a university portal).
Results tagged with "⚠️ PROFILE PAGE" have been automatically detected as profile URLs.
{profile_resolved_note}
YOU CANNOT KNOW what sections a page has from a search snippet. Do NOT claim a page "has sections
for People, Research, Publications" unless the URL itself is clearly a standalone lab domain.
Judge ONLY by the URL structure and the search snippet — do not invent content.

Output JSON:
{{
  "url": "the chosen URL or null",
  "confidence": 0-10,
  "reasoning": "why"
}}

SCORING (by URL structure, not imagined content):
- 9-10: A dedicated lab domain/subdomain (labname.ucsd.edu, labname.org, dept.ucsd.edu/labname/).
  Boost to 10 if also tagged LINKED FROM PROFILE.
- 7-8: A department page that MIGHT be a lab section (not a single-person profile path).
- 5-6: A profile/directory/bio page — pick ONLY if nothing better exists. These often link to the real lab.
- 0-4: Wrong person, social media, publications database.

RESULTS:
{candidate_list}
""".strip()

    try:
        response = await client.chat.completions.create(
            model="meta-llama/llama-3.1-8b-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        usage = response.usage
        call_cost = getattr(usage, "cost", 0.0)
        total_cost += call_cost

        raw_content = response.choices[0].message.content.strip()
        data = json.loads(raw_content)
        print(json.dumps(data, indent=2))
        url = data.get("url")
        confidence = data.get("confidence", 0)
        reasoning = data.get("reasoning", "")
        
        if not url or url == "null":
            return None

        # Hard cap: if the URL is obviously a profile page, don't trust a high score
        if is_profile_url(url) and confidence > 6:
            print(f"  📉 Capped confidence {confidence}→6 for profile URL: {url}")
            confidence = 6

        if confidence < 5:
            print(f"  ⚠️  Low confidence ({confidence}/10) for {faculty['name']} -> {url} ({reasoning})")
            return None

        return url
    except Exception as e:
        print(f"  LLM error for {faculty['name']}: {e}")
        return None

async def find_url_for_professor(session: aiohttp.ClientSession, api_key: str, faculty: Faculty) -> FacultyWithURL:
    global brave_requests
    try:
        params = {
            "q": build_query(faculty["name"], faculty["department"]),
            "count": 15, # Increased count to get more candidates
        }
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key,
        }
        async with session.get(
            "https://api.search.brave.com/res/v1/web/search",
            params=params,
            headers=headers,
        ) as resp:
            brave_requests += 1
            data = await resp.json()
            candidates = []
            for r in data.get("web", {}).get("results", []):
                url = r.get("url", "")
                if url and not is_bad_url(url):
                    candidates.append({
                        "url": url,
                        "title": r.get("title", ""),
                        "snippet": r.get("description", "")
                    })
            
            if not candidates:
                return {**faculty, "lab_url": None, "lab_url_uncertain_reason": None}

            # Pre-LLM: check profile-URL candidates for lab links and add
            # discovered lab URLs as high-quality candidates before the LLM ranks.
            seen_urls = {c["url"] for c in candidates}
            profile_candidates = [c for c in candidates if is_profile_url(c["url"])]
            for pc in profile_candidates[:3]:  # cap to avoid too many fetches
                resolved = await resolve_lab_url(session, pc["url"], name=faculty["name"])
                if resolved != pc["url"] and resolved not in seen_urls:
                    seen_urls.add(resolved)
                    candidates.append({
                        "url": resolved,
                        "title": f"Lab website (found via {pc['title']})",
                        "snippet": f"Linked from profile page: {pc['url']}",
                        "profile_resolved": True,
                    })

            # Use LLM to pick the best candidate
            best_url = await select_best_url_llm(faculty, candidates)
            # If the URL is still a profile page, try to resolve it to the real lab
            if best_url:
                best_url = await resolve_lab_url(session, best_url, name=faculty["name"])

            if not best_url:
                return {**faculty, "lab_url": None, "lab_url_uncertain_reason": None}

            # Verify the lab page actually belongs to this professor
            certain, reason = await verify_lab_url(session, best_url, faculty["name"])
            if not certain:
                print(f"  ⚠️  Uncertain: {faculty['name']} → {best_url} ({reason})")
            return {**faculty, "lab_url": best_url, "lab_url_uncertain_reason": None if certain else reason}

    except Exception as e:
        print(f"  Brave error for {faculty['name']}: {e}")
    return {**faculty, "lab_url": None, "lab_url_uncertain_reason": None}

async def run() -> None:
    from config import BRAVE_API_KEY, FACULTY_FILE, FACULTY_URLS_FILE
    from verify import confirm

    print("Stage 2: Finding lab URLs via Brave Search + LLM Ranking...")
    faculty: list[Faculty] = json.loads(FACULTY_FILE.read_text())
    
    # For testing, you might want to limit this, but let's assume we run on the full list or a slice
    # To reproduce the specific issue, we can filter for Padmini Rangamani
    # faculty = [f for f in faculty if "Rangamani" in f["name"]]
    # print(f"  Testing for: {[f['name'] for f in faculty]}")

    CONCURRENCY = 10
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: list[FacultyWithURL] = []

    async with aiohttp.ClientSession() as session:
        async def bounded(f):
            async with semaphore:
                return await find_url_for_professor(session, BRAVE_API_KEY, f)

        tasks = [bounded(f) for f in faculty]
        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            result = await coro
            results.append(result)
            if i % 5 == 0:
                brave_cost = brave_requests / 1000 * BRAVE_COST_PER_1000
                print(f"  {i}/{len(faculty)} done... LLM: ${total_cost:.8f} | Brave: ${brave_cost:.4f} ({brave_requests} reqs)")

    found = [r for r in results if r["lab_url"]]
    missing = [r for r in results if not r["lab_url"]]
    uncertain = [r for r in found if r.get("lab_url_uncertain_reason")]

    brave_cost = brave_requests / 1000 * BRAVE_COST_PER_1000
    print(f"\nFinal total LLM cost:   ${total_cost:.8f}")
    print(f"Final total Brave cost: ${brave_cost:.4f} ({brave_requests} requests @ $5/1000)")
    print(f"Found URL: {len(found)}  ({len(uncertain)} uncertain)")
    print(f"Skipped (no URL found): {len(missing)}")

    if uncertain:
        print(f"\n⚠️  Uncertain URLs — please review before running stage 3:")
        for r in uncertain:
            print(f"  {r['name']}")
            print(f"    URL:    {r['lab_url']}")
            print(f"    Reason: {r['lab_url_uncertain_reason']}")

        from config import UNCERTAIN_URLS_LOG
        from datetime import datetime
        UNCERTAIN_URLS_LOG.parent.mkdir(parents=True, exist_ok=True)
        with UNCERTAIN_URLS_LOG.open("w", encoding="utf-8") as f:
            f.write(f"# Uncertain lab URLs — generated {datetime.now().isoformat(timespec='seconds')}\n")
            f.write(f"# {len(uncertain)} entries. Edit faculty_with_urls.json to fix before running stage 3.\n\n")
            for r in uncertain:
                f.write(f"name:   {r['name']}\n")
                f.write(f"url:    {r['lab_url']}\n")
                f.write(f"reason: {r['lab_url_uncertain_reason']}\n\n")
        print(f"\n  📄 Written to {UNCERTAIN_URLS_LOG}")

    if found:
        import random
        certain_found = [r for r in found if not r.get("lab_url_uncertain_reason")]
        samples = random.sample(certain_found, min(10, len(certain_found))) if certain_found else []
        if samples:
            print("\nRandom sample (certain, name → URL):")
            for r in samples:
                print(f"  {r['name']} → {r['lab_url']}")

    if missing:
        print(f"\nProfessors with no lab URL ({len(missing)}) — these will be skipped in later stages:")
        for r in missing[:20]:
            print(f"  {r['name']}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    certain_count = len(found) - len(uncertain)
    if not confirm(f"Save results? ({certain_count} certain, {len(uncertain)} uncertain skipped, {len(missing)} no URL)"):
        print("Aborted.")
        return

    # Null out lab_url for uncertain entries so downstream stages skip them
    output = [
        r if not r.get("lab_url_uncertain_reason") else {**r, "lab_url": None}
        for r in results
    ]
    FACULTY_URLS_FILE.write_text(json.dumps(output, indent=2))
    print(f"✅ Saved to {FACULTY_URLS_FILE}")
    print("   Tip: edit faculty_with_urls.json to manually fix uncertain URLs before stage 3.")
