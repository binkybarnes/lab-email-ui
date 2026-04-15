# scraper/tests/test_stage3.py
from stages.stage3_crawl import should_follow_url, is_strong_people_page, make_slug, verify_name_in_text

def test_verify_name_in_text_exact_match():
    assert verify_name_in_text("Omar Akbari", "This is Omar Akbari") is True

def test_verify_name_in_text_middle_initial():
    assert verify_name_in_text("Omar Akbari", "Omar S. Akbari, PhD") is True

def test_verify_name_in_text_middle_name():
    assert verify_name_in_text("Omar Akbari", "Omar Sultan Akbari") is True

def test_verify_name_in_text_case_insensitive():
    assert verify_name_in_text("omar akbari", "OMAR AKBARI") is True

def test_verify_name_in_text_no_match():
    assert verify_name_in_text("John Doe", "Omar Akbari's Lab") is False

def test_verify_name_in_text_empty():
    assert verify_name_in_text("Omar Akbari", "") is False

def test_should_follow_url_allows_people():
    assert should_follow_url("https://lab.ucsd.edu/people") is True

def test_should_follow_url_allows_team():
    assert should_follow_url("https://lab.ucsd.edu/team") is True

def test_should_follow_url_allows_members():
    assert should_follow_url("https://lab.ucsd.edu/members") is True

def test_should_follow_url_allows_about():
    assert should_follow_url("https://lab.ucsd.edu/about") is True

def test_should_follow_url_allows_research():
    assert should_follow_url("https://lab.ucsd.edu/research") is True

def test_should_follow_url_blocks_blog():
    assert should_follow_url("https://lab.ucsd.edu/blog/post-1") is False

def test_should_follow_url_blocks_publications():
    assert should_follow_url("https://lab.ucsd.edu/publications") is False

def test_should_follow_url_blocks_news():
    assert should_follow_url("https://lab.ucsd.edu/news/2024") is False

def test_is_strong_people_page_priority_url():
    # Priority 1 URLs need weak signal (2 roles or 1 email)
    md = "Jane Smith, PhD student\nBob Jones, Postdoc"
    assert is_strong_people_page(md, "https://lab.edu/directory") is True

def test_is_strong_people_page_generic_url_emails():
    # Generic URLs need strong signal (4+ emails)
    md = "1@a.edu 2@a.edu 3@a.edu 4@a.edu"
    assert is_strong_people_page(md, "https://lab.edu/") is True

def test_is_strong_people_page_generic_url_roles():
    # Generic URLs need strong signal (8+ roles)
    md = "phd postdoc faculty researcher graduate student professor undergrad phd"
    assert is_strong_people_page(md, "https://lab.edu/") is True

def test_is_strong_people_page_generic_url_table():
    # Generic URLs need strong signal (| name |)
    md = "| Name | Role |\n| John | PhD |"
    assert is_strong_people_page(md, "https://lab.edu/") is True

def test_is_strong_people_page_false_for_generic_page():
    assert is_strong_people_page("Welcome to our lab. We do research.", "https://lab.edu/") is False

def test_make_slug():
    assert make_slug("AI Systems Lab") == "ai-systems-lab"
    assert make_slug("Dr. Smith's Lab!") == "dr-smiths-lab"
