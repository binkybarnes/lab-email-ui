import json
import asyncio
import re
from pathlib import Path
from models import FacultyWithURL

ALLOWED_URL_KEYWORDS = ["people", "team", "members", "lab", "about", "research"]
BLOCKED_URL_KEYWORDS = ["blog", "news", "publication", "paper", "seminar", "event", "course", "class", "cv"]
PEOPLE_ROLE_KEYWORDS = ["phd", "postdoc", "graduate student", "researcher", "professor", "faculty", "undergraduate"]
PRIORITY_KEYWORDS = ["member", "people", "team", "group", "lab", "about", "who"]
MAX_DEPTH = 2
MAX_PAGES_PER_DOMAIN = 20
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


async def crawl_lab(crawler, faculty: FacultyWithURL) -> tuple[str, str]:
    """Returns (slug, combined_markdown). BFS crawl up to MAX_DEPTH levels deep."""
    from crawl4ai import CrawlerRunConfig, CacheMode
    from urllib.parse import urlparse

    slug = make_slug(faculty["name"])
    url = faculty["lab_url"]
    combined_md = []

    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=PAGE_TIMEOUT,
    )

    homepage_path = urlparse(url).path.rstrip("/")
    seen_paths = {homepage_path, homepage_path + "/"}
    if homepage_path.endswith("/index.html") or homepage_path.endswith("/index.htm"):
        seen_paths.add(homepage_path.rsplit("/index", 1)[0])

    def extract_links(result):
        """Extract candidate links from a crawl result, deduplicated and filtered."""
        candidates = []
        for lnk in (result.links.get("internal", []) or []):
            href = lnk.get("href", "")
            if not href:
                continue
            path = urlparse(href).path.rstrip("/").split("?")[0]
            if any(kw in href.lower().split("?")[0] for kw in BLOCKED_URL_KEYWORDS):
                continue
            if path in seen_paths or path + "/" in seen_paths:
                continue
            if path.endswith("/index.html") or path.endswith("/index.htm"):
                base = path.rsplit("/index", 1)[0]
                if base in seen_paths or base == homepage_path:
                    continue
            seen_paths.add(path)
            priority = 0 if any(kw in href.lower() for kw in PRIORITY_KEYWORDS) else 1
            candidates.append((priority, href))
        candidates.sort(key=lambda x: x[0])
        return [href for _, href in candidates]

    # BFS: queue holds (url, depth) pairs
    queue = [(url, 0)]
    pages_crawled = 0

    while queue and pages_crawled < MAX_PAGES_PER_DOMAIN:
        current_url, depth = queue.pop(0)
        result = await crawler.arun(current_url, config=config)
        if not result.success:
            continue
        if result.markdown:
            combined_md.append(result.markdown)
        pages_crawled += 1

        if depth < MAX_DEPTH:
            child_links = extract_links(result)
            for link in child_links:
                if pages_crawled + len(queue) < MAX_PAGES_PER_DOMAIN:
                    queue.append((link, depth + 1))

    return slug, "\n\n".join(combined_md)


async def run() -> None:
    from crawl4ai import AsyncWebCrawler
    from config import FACULTY_URLS_FILE, CRAWLED_DIR
    from verify import confirm

    print("Stage 3: Crawling lab pages...")
    faculty_list: list[FacultyWithURL] = json.loads(FACULTY_URLS_FILE.read_text())
    to_crawl = [f for f in faculty_list if f.get("lab_url")]
    skipped = len(faculty_list) - len(to_crawl)
    print(f"  {len(to_crawl)} labs to crawl, {skipped} skipped (no URL)")

    CRAWLED_DIR.mkdir(parents=True, exist_ok=True)
    success, failed = 0, 0
    lengths = []
    results = []

    CONCURRENCY = 5
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with AsyncWebCrawler() as crawler:
        async def bounded_crawl(f):
            async with semaphore:
                return await crawl_lab(crawler, f)

        tasks = [bounded_crawl(f) for f in to_crawl]
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
        print(f"\n⚠️  {len(short)} suspiciously short pages (<200 chars):")
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

    print(f"Crawled pages saved to {CRAWLED_DIR}")
