import json
import asyncio
from models import Faculty, FacultyWithURL

BAD_URL_PATTERNS = [
    "linkedin.com",
    "scholar.google.com",
    "twitter.com",
    "x.com",
    "ratemyprofessors.com",
    "profiles.ucsd.edu",
    "researcherprofiles.org",
    "researchgate.net",
    "facebook.com",
]

def is_bad_url(url: str) -> bool:
    return any(pattern in url for pattern in BAD_URL_PATTERNS)

def build_query(name: str) -> str:
    return f"{name} UCSD professor research lab website"

async def find_url_for_professor(exa, faculty: Faculty) -> FacultyWithURL:
    try:
        results = exa.search(build_query(faculty["name"]), num_results=5)
        for r in results.results:
            if r.url and not is_bad_url(r.url):
                return {**faculty, "lab_url": r.url}
    except Exception as e:
        print(f"  Exa error for {faculty['name']}: {e}")
    return {**faculty, "lab_url": None}

async def run() -> None:
    from exa_py import Exa
    from config import EXA_API_KEY, FACULTY_FILE, FACULTY_URLS_FILE
    from verify import confirm

    print("Stage 2: Finding lab URLs via Exa...")
    faculty: list[Faculty] = json.loads(FACULTY_FILE.read_text())
    exa = Exa(api_key=EXA_API_KEY)

    CONCURRENCY = 10
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: list[FacultyWithURL] = []

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
    print(f"Skipped (no URL found): {len(missing)}")

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
