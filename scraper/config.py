import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

BRAVE_API_KEY = os.environ["BRAVE_API_KEY"]
OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]

DATA_DIR = Path(__file__).parent / "data"
CRAWLED_DIR = DATA_DIR / "crawled_pages"
OUTPUT_DIR = Path(__file__).parent / "output"

FACULTY_FILE = DATA_DIR / "faculty.json"
FACULTY_URLS_FILE = DATA_DIR / "faculty_with_urls.json"
LABS_RAW_FILE = DATA_DIR / "labs_raw.json"
LABS_OUTPUT_FILE = OUTPUT_DIR / "labs.json"
UNCERTAIN_URLS_LOG = DATA_DIR / "uncertain_urls.log"

PROFILES_CSV = Path(__file__).parent.parent / "src" / "data" / "profiles.csv"
