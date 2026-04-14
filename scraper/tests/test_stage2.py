from stages.stage2_urls import is_bad_url, build_query

def test_is_bad_url_rejects_linkedin():
    assert is_bad_url("https://linkedin.com/in/samsmith") is True

def test_is_bad_url_rejects_scholar():
    assert is_bad_url("https://scholar.google.com/citations?user=abc") is True

def test_is_bad_url_rejects_twitter():
    assert is_bad_url("https://twitter.com/samsmith") is True

def test_is_bad_url_rejects_ratemyprofessor():
    assert is_bad_url("https://www.ratemyprofessors.com/professor/123") is True

def test_is_bad_url_rejects_ucsd_profiles():
    assert is_bad_url("https://profiles.ucsd.edu/sam.smith") is True

def test_is_bad_url_accepts_lab_website():
    assert is_bad_url("https://ai-lab.ucsd.edu") is False

def test_is_bad_url_accepts_personal_site():
    assert is_bad_url("https://samsmith.github.io") is False

def test_build_query():
    q = build_query("Sam Lau")
    assert "Sam Lau" in q
    assert "UCSD" in q
    assert "research" in q.lower() or "lab" in q.lower()
