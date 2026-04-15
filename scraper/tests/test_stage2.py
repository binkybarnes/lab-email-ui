import pytest
from unittest.mock import AsyncMock, patch
from stages.stage2_urls import is_bad_url, build_query, select_best_url_llm

def test_is_bad_url_rejects_grantome():
    assert is_bad_url("https://grantome.com/grant/NIH/P30-CA023100-27S9-9010") is True

def test_is_bad_url_rejects_pubmed():
    assert is_bad_url("https://pubmed.ncbi.nlm.nih.gov/12345/") is True

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

def test_is_bad_url_rejects_directory():
    assert is_bad_url("https://directory.ucsd.edu/sam.smith") is True

def test_is_bad_url_rejects_blink():
    assert is_bad_url("https://blink.ucsd.edu/faculty/sam") is True

def test_is_bad_url_accepts_lab_website():
    assert is_bad_url("https://ai-lab.ucsd.edu") is False

def test_is_bad_url_accepts_personal_site():
    assert is_bad_url("https://samsmith.github.io") is False

def test_build_query():
    q = build_query("Sam Lau", "Computer Science")
    assert "Sam Lau" in q
    assert "UCSD" in q
    assert "research" in q.lower() or "lab" in q.lower()

@pytest.mark.asyncio
async def test_select_best_url_llm_picks_correct_one():
    faculty = {"name": "Padmini Rangamani", "department": "Pharmacology"}
    candidates = [
        {"url": "https://bioengineering.ucsd.edu/content/padmini-rangamani", "title": "Padmini Rangamani | Bioengineering", "snippet": "Bio..."},
        {"url": "https://rangamani.ucsd.edu/", "title": "Rangamani Lab", "snippet": "Research in the Rangamani Lab focuses on..."}
    ]
    
    # Mock the LLM response
    with patch("stages.stage2_urls.AsyncOpenAI") as mock_openai:
        mock_client = mock_openai.return_value
        # Create a mock completion object with choices
        mock_response = AsyncMock()
        content = '{"url": "https://rangamani.ucsd.edu/", "confidence": 10, "reasoning": "Lab website found"}'
        mock_response.choices = [AsyncMock(message=AsyncMock(content=content))]
        mock_response.usage = AsyncMock(prompt_tokens=100, completion_tokens=10)
        
        # Setup the mock to return this response
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        result = await select_best_url_llm(faculty, candidates)
        assert result == "https://rangamani.ucsd.edu/"
