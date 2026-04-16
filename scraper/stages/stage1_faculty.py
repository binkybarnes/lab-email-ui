import csv
import json
import random
from pathlib import Path
from models import Faculty


def normalize_row(row: dict) -> Faculty:
    return {
        "name": row.get("listTableLink", "").strip(),
        "department": row.get("alignLeft", "").strip(),
        "profile_url": row.get("listTableLink href", "").strip(),
    }


def is_valid_faculty(f: Faculty) -> bool:
    return bool(f["name"] and f["profile_url"])


def load_faculty_from_csv(csv_path: Path) -> list[Faculty]:
    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        return [f for f in (normalize_row(row) for row in reader) if is_valid_faculty(f)]


def print_verify_summary(faculty: list[Faculty]) -> None:
    print(f"\nTotal faculty loaded: {len(faculty)}")
    if len(faculty) < 10:
        print("  WARNING: fewer than 10 results — check CSV path")
    samples = random.sample(faculty, min(5, len(faculty)))
    print("\nRandom sample:")
    for f in samples:
        print(f"  {f['name']} — {f['department']}")


async def run() -> None:
    from config import FACULTY_FILE, PROFILES_CSV
    from verify import confirm

    print("Stage 1: Loading faculty from CSV...")
    faculty = load_faculty_from_csv(PROFILES_CSV)[:100]

    print_verify_summary(faculty)

    if not confirm(f"Save {len(faculty)} faculty records to data/faculty.json?"):
        print("Aborted.")
        return

    FACULTY_FILE.parent.mkdir(parents=True, exist_ok=True)
    FACULTY_FILE.write_text(json.dumps(faculty, indent=2))
    print(f"Saved to {FACULTY_FILE}")
