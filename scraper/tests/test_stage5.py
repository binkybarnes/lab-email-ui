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

FACULTY_DATA = [
    {"name": "Jane Smith", "department": "CSE"},
]

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
    output = build_output([RAW_LAB], FACULTY_DATA)
    assert output["departments"][0]["id"] == "cse"
    assert len(output["departments"][0]["labs"]) == 1

def test_build_output_skips_labs_with_no_name():
    no_name = {**RAW_LAB, "lab_name": ""}
    output = build_output([no_name], FACULTY_DATA)
    # All labs skipped → no departments emitted at all
    assert len(output["departments"]) == 0
