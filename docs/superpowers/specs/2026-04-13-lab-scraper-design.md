# Lab Scraper — Design Spec
**Date:** 2026-04-13
**Scope:** UCSD CSE department (expand to other departments later)
**Goal:** Produce a `labs.json` file for the lab-emailer UI containing real UCSD lab data

---

## Overview

A 5-stage async Python pipeline that lives in `scraper/` inside the lab-emailer repo. Each stage reads from and writes to disk so any stage can be rerun independently. A verify step after each stage prints a summary and prompts confirmation before the next stage runs. Run stages individually for testing or chain them all with `python pipeline.py all`.

---

## Output Schema

```json
{
  "departments": [
    {
      "id": "cse",
      "name": "Computer Science & Engineering",
      "labs": [
        {
          "id": "slug-from-name",
          "name": "Lab Name",
          "website": "https://lab.ucsd.edu",
          "overview": "1-2 sentence description of what the lab does.",
          "members": [
            {
              "id": "slug-from-name",
              "name": "Dr. Jane Smith",
              "role": "PI",
              "email": "jsmith@ucsd.edu",
              "photo": "https://lab.ucsd.edu/images/jsmith.jpg"
            }
          ]
        }
      ]
    }
  ]
}
```

- `email` and `photo` are optional — omit the field if not found (don't include nulls)
- `role` values: `PI`, `PhD`, `Postdoc`, `Masters`, `Undergrad`, `Staff` — LLM picks closest match
- One lab per PI. If a lab page lists multiple faculty, the one whose profile pointed to it is the PI.

---

## Stack

| Step | Tool | Cost |
|------|------|------|
| Faculty list | UCSD Profiles API (SSO) | Free |
| Find lab URLs | Exa API | ~$10 free credits covers CSE |
| Crawl lab pages | Crawl4AI (async) | Free |
| Extract structured data | OpenRouter → Claude Haiku | ~$0.50 total |
| Output | Python json stdlib | Free |

---

## Directory Structure

```
scraper/
  pipeline.py          ← main entrypoint
  stages/
    stage1_faculty.py
    stage2_urls.py
    stage3_crawl.py
    stage4_extract.py
    stage5_merge.py
  data/
    faculty.json               ← stage 1 output
    faculty_with_urls.json     ← stage 2 output
    crawled_pages/             ← stage 3 output (one .md file per lab)
    labs_raw.json              ← stage 4 output
  output/
    labs.json                  ← final output, copy to ../src/data/ when ready
  .env                         ← UCSD_SSO_TOKEN, EXA_API_KEY, OPENROUTER_API_KEY
  requirements.txt
```

---

## Stage 1 — Faculty List

**Command:** `python pipeline.py stage1`
**Input:** UCSD Profiles API (SSO auth)
**Output:** `data/faculty.json`

Fetches all faculty in the CSE department using the UCSD Profiles API. Each record includes name, department, and profile URL.

**Verify step prints:**
- Total count (expect ~300–400)
- 5 random sample names
- Count of records missing any required field

**Failure modes:**
- SSO token expired → clear error message, instructions to refresh
- API returns fewer than 100 results → warn, likely wrong department filter

---

## Stage 2 — Find Lab URLs

**Command:** `python pipeline.py stage2`
**Input:** `data/faculty.json`
**Output:** `data/faculty_with_urls.json`

For each professor, runs an async Exa search: `"[name] UCSD CSE professor research lab"`. Takes the top result URL. Skips if URL is a LinkedIn, Twitter, Google Scholar, or Rate My Professor page. Marks as `url: null` if no good result found.

Runs 10 searches concurrently to stay within Exa rate limits.

**Verify step prints:**
- Count with URL found vs. missing
- 10 random name → URL pairs to spot-check
- List of all professors where URL is null (so you can manually add)

**Note:** You can manually edit `faculty_with_urls.json` to fix bad URLs before running stage 3.

---

## Stage 3 — Crawl Lab Pages

**Command:** `python pipeline.py stage3`
**Input:** `data/faculty_with_urls.json`
**Output:** `data/crawled_pages/<lab-slug>.md`

For each lab URL, Crawl4AI fetches the page and converts it to markdown. Crawling is limited:
- **Max depth:** 1 (homepage + direct links only)
- **Max pages per domain:** 3
- **URL keyword filter:** only follow paths containing `people`, `team`, `members`, `lab`, `about`, `research`
- **Early stop:** if homepage markdown already contains role keywords (PhD, postdoc, professor), skip subpage crawl
- **Timeout:** 15 seconds per page

Skips labs with `url: null`. Saves one `.md` file per lab named by slug.

**Verify step prints:**
- Count crawled successfully vs. failed/timed out
- Average markdown length (flag anything under 200 chars as likely broken)
- 3 random samples showing first 300 chars of markdown

---

## Stage 4 — LLM Extraction

**Command:** `python pipeline.py stage4`
**Input:** `data/crawled_pages/`
**Output:** `data/labs_raw.json`

For each crawled markdown file, sends it to Claude Haiku via OpenRouter with a system prompt and a strict JSON schema. Extracts: lab name, overview (1–2 sentences), and a list of members (name, role, email if present, photo URL if present).

Prompt instructs the model to:
- Only extract people explicitly listed on the page (no hallucination)
- Use the closest role category from the allowed list
- Return `{}` if the page clearly has no lab/people content

Runs 5 extractions concurrently.

**Verify step prints:**
- Count extracted successfully vs. returned empty
- 5 random labs with their extracted member count and overview
- Total estimated token cost

---

## Stage 5 — Merge

**Command:** `python pipeline.py stage5`
**Input:** `data/labs_raw.json`
**Output:** `output/labs.json`

Groups labs by department, generates slugs from lab names, strips null fields, and writes the final `labs.json` matching the UI schema. No deduplication needed.

**Verify step prints:**
- Total labs, total members
- Breakdown: how many labs have 0 members (possible extraction failure)
- Confirmation prompt before writing output

---

## Running Everything

```bash
# Test each stage individually
python pipeline.py stage1
python pipeline.py stage2
python pipeline.py stage3
python pipeline.py stage4
python pipeline.py stage5

# Run all stages with verify prompts between each
python pipeline.py all

# Rerun a single stage without re-fetching earlier stages
python pipeline.py stage3 --force
```

---

## Environment Setup

```
UCSD_SSO_TOKEN=...       # from browser dev tools after logging into profiles.ucsd.edu
EXA_API_KEY=...          # from exa.ai dashboard
OPENROUTER_API_KEY=...   # from openrouter.ai dashboard
```

---

## What's Out of Scope

- Other departments (add later by changing the department filter in stage 1)
- Automatic refresh / scheduling
- Email validation or enrichment
- Google Scholar / LinkedIn scraping
