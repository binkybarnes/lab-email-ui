import json
import asyncio
import re
import time
from pathlib import Path
from models import FacultyWithURL
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode, MemoryAdaptiveDispatcher

ALLOWED_URL_KEYWORDS = ["people", "team", "members", "lab", "about", "research", "staff", "students", "directory", "group"]
BLOCKED_URL_KEYWORDS = [
    "blog", "news", "publication", "paper", "seminar", "event", "course", "class", "cv",
    "map", "direction", "parking", "shuttle", "traffic", "hotel", "sponsors", "intranet",
    "gallery", "meeting", "wp-content", "wp-includes", "themes"
]
BAD_URL_PATTERNS = [
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
]


def is_bad_url(url: str) -> bool:
    return any(pattern in url.lower() for pattern in BAD_URL_PATTERNS)


BLOCKED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".gz", ".tar"}
PEOPLE_ROLE_KEYWORDS = ["phd", "principal investigator", "pi", "staff", "post doc", "undergrad", "postdoc", "graduate student", "researcher", "professor", "faculty", "undergraduate"]
MAX_PAGES_PER_DOMAIN = 5
PAGE_TIMEOUT = 30000  # ms

DECORATIVE_IMG_KEYWORDS = ["logo", "banner", "favicon", "icon", "stroke", "shapeimage"]
JUNK_LINES = frozenset({"Open Menu Close Menu", "\u00ad"})


def _is_nav_link_line(line: str) -> bool:
    """Check if a line is a standalone navigation link (not an image)."""
    s = line.strip()
    if not s:
        return False
    s = re.sub(r"^[\*\-\+]\s+", "", s)
    s = re.sub(r"^\d+\.\s+", "", s)
    return bool(re.match(r"^\[(?!!)[^\]]+\]\([^)]+\)\s*$", s))


def _is_decorative_image(url: str, alt: str = "") -> bool:
    combined = (url + " " + alt).lower()
    return any(kw in combined for kw in DECORATIVE_IMG_KEYWORDS)


def clean_markdown(md: str) -> str:
    """Remove boilerplate from crawled markdown while keeping content and profile photos."""
    if not md:
        return md

    lines = md.split("\n")
    cleaned = []
    
    # Junk patterns to skip
    JUNK_BLOCK_KEYWORDS = {"maps.ucsd.edu", "parking.ucsd.edu", "transportation.ucsd.edu", "shuttles", "copyright"}

    for line in lines:
        s = line.strip()

        # Keep blank lines (collapse later)
        if not s:
            cleaned.append("")
            continue

        # Remove known junk
        if s in JUNK_LINES:
            continue
        if "Skip to Content" in s or "Skip to content" in s:
            continue
        if re.match(r"\[\s*\d+\s*\]\(.*cart", s, re.I):
            continue
        
        # Aggressive junk line filter
        if any(kw in s.lower() for kw in JUNK_BLOCK_KEYWORDS):
            if not any(kw in s.lower() for kw in PEOPLE_ROLE_KEYWORDS):
                continue

        # Linked logo images: [ ![alt](img) ](link) or [![alt](img)](link)
        if re.match(r"^\[?\s*!\[", s):
            inner = re.search(r"!\[([^\]]*)\]\(([^)]+)\)", s)
            if inner:
                text_without = re.sub(
                    r"\[?\s*!\[[^\]]*\]\([^)]+\)\s*\]?\s*(\([^)]+\))?", "", s
                ).strip()
                if not text_without and _is_decorative_image(
                    inner.group(2), inner.group(1)
                ):
                    continue

        # Pure image lines (no surrounding text) — filter decorative ones
        content = re.sub(r"^[\s\*\-\+]*", "", s)
        text_remaining = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", content).strip()
        if not text_remaining and "![" in content:
            images = re.findall(r"(!\[([^\]]*)\]\(([^)]+)\))", s)
            kept = [
                full
                for full, alt, url in images
                if not _is_decorative_image(url, alt)
            ]
            if not kept:
                continue
            prefix_match = re.match(r"^(\s*[\*\-\+]\s+|\s*)", line)
            prefix = prefix_match.group(0) if prefix_match else ""
            cleaned.append((prefix + "".join(kept)).rstrip())
            continue

        cleaned.append(line.rstrip())

    # Remove nav link clusters (3+ consecutive link-only lines)
    phase2 = []
    i = 0
    while i < len(cleaned):
        if _is_nav_link_line(cleaned[i]):
            run_start = i
            while i < len(cleaned) and _is_nav_link_line(cleaned[i]):
                i += 1
            if i - run_start < 3:
                phase2.extend(cleaned[run_start:i])
        else:
            phase2.append(cleaned[i])
            i += 1

    # Normalize block boundaries before dedup
    text = "\n".join(phase2)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Ensure headings always start a new block
    text = re.sub(r"\n(#{1,6}\s)", r"\n\n\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Deduplicate paragraph blocks and filter irrelevant sections (News, Publications)
    blocks = text.split("\n\n")
    seen = set()
    unique = []
    
    skip_mode = False
    skip_level = 0

    for block in blocks:
        s = block.strip()
        if not s:
            continue
            
        # Check for headings to toggle skip mode
        match = re.match(r"^(#{1,6})\s+(.*)", s)
        if match:
            level = len(match.group(1))
            heading_text = match.group(2).lower()
            
            # Cancel skip mode if we hit a heading of equal or higher level
            if skip_mode and level <= skip_level:
                skip_mode = False
                
            # Start skip mode if heading matches irrelevant content
            if any(kw in heading_text for kw in ["news", "publication", "paper", "recent update", "event"]):
                skip_mode = True
                skip_level = level
                continue  # Skip the heading block itself
                
        if skip_mode:
            continue

        key = re.sub(r"\s+", " ", s)
        if key in seen:
            continue
        seen.add(key)
        unique.append(block)

    text = "\n\n".join(unique)
    return text.strip()


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


def link_priority(url: str, anchor_text: str = "") -> int:
    combined = url.lower().split("?")[0] + " " + anchor_text.lower()
    if any(kw in combined for kw in ["people", "member", "team", "directory", "group", "staff", "student", "faculty"]):
        return 1
    if any(kw in combined for kw in ["research", "about", "project"]):
        return 2
    return 10


def is_strong_people_page(markdown: str, url: str) -> bool:
    """Return True if the page has a strong density of names, roles, or emails."""
    lower = markdown.lower()
    
    # 1. Emails
    emails = set(re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', lower))
    
    # 2. Roles
    role_count = sum(lower.count(kw) for kw in PEOPLE_ROLE_KEYWORDS)
    
    # If the URL implies it's the people page, we only need a weak signal
    if link_priority(url) == 1:
        if role_count >= 2 or len(emails) >= 1:
            return True
            
    # Otherwise, require a strong signal
    if len(emails) >= 4:
        return True
    if role_count >= 8:
        return True
    if "| name " in lower or "|name" in lower:
        return True
        
    return False


def verify_name_in_text(name: str, text: str) -> bool:
    """Check if the professor's name appears in the text, allowing for middle names/initials/suffixes."""
    if not text:
        return False
        
    name_lower = name.lower()
    text_lower = text.lower()
    
    # Simple direct match
    if name_lower in text_lower:
        return True
    
    # Split the name into parts (first, last, and potentially middle)
    parts = name_lower.split()
    if len(parts) >= 2:
        first = parts[0]
        last = parts[-1]
        
        # Look for first and last name with a reasonable amount of text in between (up to 50 chars)
        # This matches "Omar S. Akbari" when the name is "Omar Akbari"
        # Using DOTALL to allow for newlines in between
        pattern = re.compile(re.escape(first) + r".{0,50}" + re.escape(last), re.IGNORECASE | re.DOTALL)
        if pattern.search(text_lower):
            return True
            
        # Match "Lastname Lab" or "Lastname Group"
        if re.search(re.escape(last) + r"\s+(lab|group)", text_lower):
            return True
            
    return False


def get_prioritized_links(result, base_url: str, seen_hrefs: set) -> list[tuple[str, str]]:
    """Extract valid internal links and sort them by likelihood of being a people/research page.

    Returns a list of (url, anchor_text) tuples so callers can store anchor text
    for priority decisions (e.g. 'Our People' → page2.html has no keywords in URL).
    """
    from urllib.parse import urlparse
    internal_links = result.links.get("internal", []) or []
    base_domain = urlparse(base_url).netloc.lower()

    seen_hrefs_local = set()
    valid_links: list[tuple[str, str]] = []
    for lnk in internal_links:
        href = lnk.get("href")
        if not href:
            continue
        if is_bad_url(href):
            continue
        parsed = urlparse(href)
        if parsed.netloc and parsed.netloc.lower() != base_domain:
            continue
        path = parsed.path.lower()
        if any(path.endswith(ext) for ext in BLOCKED_EXTENSIONS):
            continue
        h = path.split("?")[0]
        if any(kw in h for kw in BLOCKED_URL_KEYWORDS):
            continue

        clean_href = href.rstrip("/")
        if clean_href in seen_hrefs or clean_href in seen_hrefs_local:
            continue
        seen_hrefs_local.add(clean_href)
        anchor = (lnk.get("text") or "").strip()
        valid_links.append((clean_href, anchor))

    return sorted(valid_links, key=lambda t: link_priority(t[0], t[1]))


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
    name_rejected: list[str] = []

    # Group professors by URL so we crawl each unique URL only once
    from collections import defaultdict
    url_to_faculty: dict[str, list[FacultyWithURL]] = defaultdict(list)
    for f in to_crawl:
        url_to_faculty[f["lab_url"]].append(f)

    # Filter unique URLs to remove obvious bad ones before starting
    unique_urls = [url for url in list(url_to_faculty.keys()) if not is_bad_url(url)]
    print(f"  {len(unique_urls)} unique URLs after filtering out grant/pub databases")

    url_to_md: dict[str, str] = {}
    
    browser_config = BrowserConfig(headless=True, verbose=False)
    # Inject headings into tab panes so the markdown separates tabbed content
    # (e.g. "Lab Members" vs "Alumni" on Bootstrap tab pages).
    tab_heading_js = """
    (function() {
        document.querySelectorAll('.nav-tabs, .nav-pills, [role="tablist"]').forEach(nav => {
            nav.querySelectorAll('a[data-toggle], a[data-bs-toggle], a[role="tab"]').forEach(a => {
                const href = a.getAttribute('href');
                if (!href || !href.startsWith('#')) return;
                const pane = document.querySelector(href);
                if (!pane) return;
                const label = a.textContent.trim();
                if (!label) return;
                if (pane.querySelector('h1,h2,h3')) return;  // already has a heading
                const h2 = document.createElement('h2');
                h2.textContent = label;
                pane.insertBefore(h2, pane.firstChild);
            });
        });
        // Also show all hidden tab panes so the crawler captures everything
        document.querySelectorAll('.tab-pane').forEach(p => {
            p.classList.add('active', 'show', 'in');
            p.style.display = 'block';
            p.style.opacity = '1';
            p.style.visibility = 'visible';
        });
    })();
    """
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=PAGE_TIMEOUT,
        magic=True,
        stream=True,
        js_code=tab_heading_js,
    )
    
    dispatcher = MemoryAdaptiveDispatcher(
        memory_threshold_percent=90.0, 
        check_interval=1.0,
        max_session_permit=10,
        memory_wait_timeout=300.0,
    )
    start = time.time()
    async with AsyncWebCrawler(config=browser_config) as crawler:
        # Wave-based BFS across all labs
        labs_state = {
            url: {
                "found_people": False,
                "queue": [url],
                "url_anchor": {url: ""},  # url -> anchor text for priority scoring
                "visited": set(),
                "markdown_parts": [],
                "pages_crawled": 0
            }
            for url in unique_urls
        }
        
        for wave in range(MAX_PAGES_PER_DOMAIN):
            wave_urls = []
            url_to_lab = {}
            for lab_url, state in labs_state.items():
                if state["pages_crawled"] >= MAX_PAGES_PER_DOMAIN:
                    continue
                # Stop if we found people, UNLESS there are still Priority 1 (people/directory) links unchecked
                if state["pages_crawled"] > 0 and state["found_people"]:
                    has_p1 = any(
                        link_priority(u, state["url_anchor"].get(u, "")) == 1
                        for u in state["queue"]
                        if u not in state["visited"]
                    )
                    if not has_p1:
                        continue
                
                next_url = None
                while state["queue"]:
                    cand = state["queue"].pop(0)
                    if cand not in state["visited"]:
                        next_url = cand
                        break
                
                if next_url:
                    wave_urls.append(next_url)
                    url_to_lab[next_url] = lab_url
                    state["visited"].add(next_url)
                    
            if not wave_urls:
                break
                
            print(f"  Wave {wave + 1}: Crawling {len(wave_urls)} pages (parallel, non-blocking)...")
            results = await crawler.arun_many(wave_urls, config=run_config, dispatcher=dispatcher)
            
            async for res in results:
                lab_url = url_to_lab.get(res.url)
                if not lab_url:
                    for req_url, l_url in url_to_lab.items():
                        if req_url.rstrip('/') == res.url.rstrip('/'):
                            lab_url = l_url
                            break
                if not lab_url:
                    print(f"  ⚠️ Could not map result URL {res.url} back to lab")
                    continue
                    
                state = labs_state[lab_url]
                state["pages_crawled"] += 1
                
                if res.success and res.markdown:
                    print(f"  ✅ {res.url}")
                    md = res.markdown
                    state["markdown_parts"].append(md)
                    
                    if is_strong_people_page(md, res.url):
                        state["found_people"] = True

                    # Always discover links so the wave loop can decide
                    # whether to follow them (e.g. P1 people links even
                    # after found_people is set).
                    new_links = get_prioritized_links(res, lab_url, state["visited"])
                    for link, anchor in new_links:
                        if link not in state["visited"] and link not in state["queue"]:
                            state["queue"].append(link)
                            state["url_anchor"][link] = anchor

                    state["queue"].sort(key=lambda u: link_priority(u, state["url_anchor"].get(u, "")))
                else:
                    print(f"  ❌ {res.url} - {res.error_message or 'Unknown error'}")

        # Assemble results
        for url in unique_urls:
            url_to_md[url] = "\n\n".join(filter(None, labs_state[url]["markdown_parts"]))

    # Assign results back to each professor, validating name appears in page
    success, failed = 0, 0
    lengths = []
    results = []

    for f in to_crawl:
        slug = make_slug(f["name"])
        md = url_to_md.get(f["lab_url"], "")

        if md and not verify_name_in_text(f["name"], md):
            name_rejected.append(f["name"])
            print(f"  ⚠️  {f['name']}: name not found in {f['lab_url']} — skipping")
            md = ""

        results.append((slug, md))
        if md:
            md = clean_markdown(md)
            success += 1
            lengths.append(len(md))
            (CRAWLED_DIR / f"{slug}.md").write_text(md)
        else:
            failed += 1

    avg_len = int(sum(lengths) / len(lengths)) if lengths else 0
    print(f"\nSuccessfully crawled: {success}")
    print(f"Failed/empty: {failed}")
    print(f"Average markdown length: {avg_len} chars")
    print(f"time elapsed :{time.time() - start}")

    if name_rejected:
        print(f"\n⚠️  {len(name_rejected)} professors rejected (name not found in crawled page):")
        for name in name_rejected:
            print(f"  {name}")

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

