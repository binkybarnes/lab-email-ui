# scraper/tests/test_stage1.py
import csv
import io
from pathlib import Path
from stages.stage1_faculty import normalize_row, is_valid_faculty, load_faculty_from_csv

SAMPLE_CSV = """listTableLink,listTableLink href,alignLeft,alignLeft 2,listTableLink href 2
Jane Smith,https://researcherprofiles.org/profile/111,Computer Science and Engineering,Professor,https://profiles.ucsd.edu/search/...
Bob Jones,https://researcherprofiles.org/profile/222,Computer Science and Engineering,Associate Professor,https://profiles.ucsd.edu/search/...
,https://researcherprofiles.org/profile/333,Computer Science and Engineering,Professor,https://profiles.ucsd.edu/search/...
"""

def test_normalize_row_extracts_name_and_dept():
    row = {
        "listTableLink": "Jane Smith",
        "listTableLink href": "https://researcherprofiles.org/profile/111",
        "alignLeft": "Computer Science and Engineering",
        "alignLeft 2": "Professor",
    }
    result = normalize_row(row)
    assert result["name"] == "Jane Smith"
    assert result["department"] == "Computer Science and Engineering"
    assert result["profile_url"] == "https://researcherprofiles.org/profile/111"

def test_is_valid_faculty_rejects_empty_name():
    assert is_valid_faculty({"name": "", "department": "CSE", "profile_url": "https://x.com"}) is False

def test_is_valid_faculty_accepts_complete_record():
    assert is_valid_faculty({"name": "Jane", "department": "CSE", "profile_url": "https://x.com"}) is True

def test_load_faculty_from_csv_parses_and_filters(tmp_path):
    csv_file = tmp_path / "test.csv"
    csv_file.write_text(SAMPLE_CSV)
    result = load_faculty_from_csv(csv_file)
    assert len(result) == 2  # third row (empty name) filtered out
    assert result[0]["name"] == "Jane Smith"
    assert result[1]["name"] == "Bob Jones"
