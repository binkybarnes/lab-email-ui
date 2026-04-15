import json
import asyncio
import aiohttp
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
    
    # Pre-process candidates for the prompt
    candidate_list = ""
    for i, c in enumerate(candidates, 1):
        candidate_list += f"{i}. Title: {c['title']}\n   URL: {c['url']}\n   Description: {c['snippet']}\n\n"
        
    prompt = f"""
I am looking for the OFFICIAL RESEARCH LAB WEBSITE for {faculty['name']} at UCSD (Department: {faculty['department']}).

A research lab website is a DEDICATED homepage for the research group. 
It should have sections for "People", "Research", "Publications", and "Join the Lab".
Usually, the URL is something like 'messer-lab.ucsd.edu', 'messerlab.com', or a dedicated subpage on a research-focused domain.

CRITICAL: DO NOT CONFUSE THIS WITH A DIRECTORY/PROFILE PAGE.
A directory/profile page (usually on a department subdomain like 'ph.ucsd.edu/directory/', 'biology.ucsd.edu/faculty/', or 'profiles.ucsd.edu') is NOT a lab website. 
It is just a bio/contact page. WE WANT THE DEDICATED RESEARCH GROUP PAGE IF IT EXISTS.

Evaluate the search results and pick the best one. 
Be EXTREMELY skeptical. If a result is a profile page, give it a LOW confidence (5-6) and ONLY pick it if it's the only option and you are certain it's the right person.
If a result is clearly a DEDICATED lab site, give it HIGH confidence (9-10).

Output a JSON object:
{{
  "url": "the chosen URL or null",
  "confidence": 0-10
}}

SCORING:
- 10: Exact name match, UCSD, and clearly a DEDICATED lab/research homepage.
- 8-9: A research group section within a department site that is clearly more than just a bio (has its own nav for members, research projects, etc.).
- 5-7: A profile/directory page (ph.ucsd.edu, biology.ucsd.edu, etc.) that is NOT a lab site. These should be a LAST RESORT.
- 0-4: Unrelated sites, general profiles (LinkedIn, Scholar), or results for the wrong person.

RESULTS:
{candidate_list}
""".strip()

    try:
        response = await client.chat.completions.create(
            model="openrouter/elephant-alpha",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        usage = response.usage
        call_cost = getattr(usage, "cost", 0.0)
        total_cost += call_cost

        raw_content = response.choices[0].message.content.strip()
        data = json.loads(raw_content)
        print(data)
        url = data.get("url")
        confidence = data.get("confidence", 0)
        reasoning = data.get("reasoning", "")
        
        if not url or url == "null":
            return None
            
        if confidence < 7:
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
                return {**faculty, "lab_url": None}
                
            # Use LLM to pick the best candidate
            best_url = await select_best_url_llm(faculty, candidates)
            return {**faculty, "lab_url": best_url}
            
    except Exception as e:
        print(f"  Brave error for {faculty['name']}: {e}")
    return {**faculty, "lab_url": None}

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

    brave_cost = brave_requests / 1000 * BRAVE_COST_PER_1000
    print(f"\nFinal total LLM cost:   ${total_cost:.8f}")
    print(f"Final total Brave cost: ${brave_cost:.4f} ({brave_requests} requests @ $5/1000)")
    print(f"Found URL: {len(found)}")
    print(f"Skipped (no URL found): {len(missing)}")

    if found:
        import random
        samples = random.sample(found, min(10, len(found)))
        print("\nRandom sample (name → URL):")
        for r in samples:
            print(f"  {r['name']} → {r['lab_url']}")

    if missing:
        print(f"\nProfessors with no lab URL ({len(missing)}) — these will be skipped in later stages:")
        for r in missing[:20]:
            print(f"  {r['name']}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    if not confirm(f"Save results? ({len(found)} with URL, {len(missing)} will be skipped)"):
        print("Aborted.")
        return

    FACULTY_URLS_FILE.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved to {FACULTY_URLS_FILE}")
    print("   Tip: edit faculty_with_urls.json to manually add any missing lab URLs before stage 3.")
