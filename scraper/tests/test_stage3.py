# scraper/tests/test_stage3.py
from stages.stage3_crawl import should_follow_url, has_people_content, make_slug

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

def test_has_people_content_detects_role_keywords():
    md = "## Lab Members\nJane Smith, PhD student\nBob Jones, Postdoc"
    assert has_people_content(md) is True

def test_has_people_content_false_for_generic_page():
    assert has_people_content("Welcome to our lab. We do research.") is False

def test_make_slug():
    assert make_slug("AI Systems Lab") == "ai-systems-lab"
    assert make_slug("Dr. Smith's Lab!") == "dr-smiths-lab"
