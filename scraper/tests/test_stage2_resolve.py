"""Tests for Stage 2 profile detection, lab URL resolution, and verification."""
import pytest
import aiohttp
from unittest.mock import AsyncMock, MagicMock
from stages.stage2_urls import is_profile_url, resolve_lab_url, verify_lab_url


# ---------- is_profile_url ----------

class TestIsProfileUrl:
    """Verify that common profile/directory URL patterns are detected."""

    def test_cmi_user_page(self):
        assert is_profile_url("https://cmi.ucsd.edu/user/shsubramaniam/")

    def test_bioengineering_content_page(self):
        assert is_profile_url("https://bioengineering.ucsd.edu/content/shankar-subramaniam")

    def test_faculty_profile_with_query(self):
        # /faculty/profile is a profile path even though ?id=19 is a query param
        assert is_profile_url("https://jacobsschool.ucsd.edu/faculty/profile?id=19")

    def test_department_faculty_page(self):
        assert is_profile_url("https://biology.ucsd.edu/faculty/john-doe")

    def test_people_page(self):
        assert is_profile_url("https://cse.ucsd.edu/people/jane-smith")

    def test_directory_page(self):
        assert is_profile_url("https://ph.ucsd.edu/directory/some-professor/")

    # --- Non-profile URLs should NOT match ---

    def test_lab_subdomain(self):
        assert not is_profile_url("https://subramanilab.biosci.ucsd.edu/")

    def test_lab_domain(self):
        assert not is_profile_url("https://genome.ucsd.edu/")

    def test_lab_path(self):
        assert not is_profile_url("https://cse.ucsd.edu/rangamani-lab/")

    def test_github_io(self):
        assert not is_profile_url("https://smithlab.github.io")


# ---------- helpers ----------

def _make_mock_session(html: str, status: int = 200):
    """Build a mock aiohttp session that returns the given HTML."""
    mock_resp = MagicMock()
    mock_resp.status = status
    mock_resp.text = AsyncMock(return_value=html)
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_resp)
    return mock_session


# ---------- resolve_lab_url (unit — mocked HTML) ----------

@pytest.mark.asyncio
class TestResolveLabUrlUnit:
    """Mocked tests for anchor-text matching — no network required."""

    async def test_lastname_lab_matches(self):
        """'Chang Lab' anchor text → followed (certainty determined by verify_lab_url later)."""
        html = '<a href="http://changlab.ucsd.edu/">Chang Lab</a>'
        resolved = await resolve_lab_url(
            _make_mock_session(html), "http://profile.ucsd.edu/user/ericchang", name="Eric Chang"
        )
        assert resolved == "http://changlab.ucsd.edu/"

    async def test_lastname_research_matches(self):
        """'Subramaniam Research' → followed."""
        html = '<a href="http://genome.ucsd.edu/">Subramaniam Research</a>'
        resolved = await resolve_lab_url(
            _make_mock_session(html), "http://profile.ucsd.edu/user/x", name="Shankar Subramaniam"
        )
        assert resolved == "http://genome.ucsd.edu/"

    async def test_explicit_phrase_always_matches(self):
        """'Lab Website' is always trusted regardless of name."""
        html = '<a href="http://some-lab.ucsd.edu/">Lab Website</a>'
        resolved = await resolve_lab_url(
            _make_mock_session(html), "http://profile.ucsd.edu/user/x", name="Eric Chang"
        )
        assert resolved == "http://some-lab.ucsd.edu/"

    async def test_generic_website_external_domain_matches(self):
        """'Website' pointing to a different domain should match."""
        html = '<a href="http://changlab.ucsd.edu/">Website</a>'
        resolved = await resolve_lab_url(
            _make_mock_session(html), "http://profile.ucsd.edu/user/ericchang", name="Eric Chang"
        )
        assert resolved == "http://changlab.ucsd.edu/"

    async def test_no_match_returns_original(self):
        """If no lab link found, return the original profile URL."""
        html = '<a href="/about">About</a> <a href="/contact">Contact</a>'
        url = "http://profile.ucsd.edu/user/x"
        resolved = await resolve_lab_url(_make_mock_session(html), url, name="Eric Chang")
        assert resolved == url


# ---------- verify_lab_url (unit — mocked HTML) ----------

@pytest.mark.asyncio
class TestVerifyLabUrlUnit:
    """Mocked tests for lab page name verification — no network required."""

    async def test_full_name_on_page_is_certain(self):
        """Both first and last name found → certain."""
        html = "<html><body>Welcome to the Eric Chang Lab at UCSD.</body></html>"
        certain, reason = await verify_lab_url(
            _make_mock_session(html), "http://changlab.ucsd.edu/", "Eric Chang"
        )
        assert certain is True
        assert reason == ""

    async def test_last_name_only_no_competing_name_is_certain(self):
        """Last name found, no competing first name → certain.
        Covers genome.ucsd.edu style pages where only 'Subramaniam' appears."""
        html = "<html><body>Subramaniam Research Group. Systems biology.</body></html>"
        certain, reason = await verify_lab_url(
            _make_mock_session(html), "http://genome.ucsd.edu/", "Shankar Subramaniam"
        )
        assert certain is True
        assert reason == ""

    async def test_wrong_first_name_is_uncertain(self):
        """Page has 'Eric Chang' but we're looking for Geoffrey Chang → uncertain."""
        html = "<html><body>Welcome to the Eric Chang Lab.</body></html>"
        certain, reason = await verify_lab_url(
            _make_mock_session(html), "http://changlab.ucsd.edu/", "Geoffrey Chang"
        )
        assert certain is False
        assert "eric" in reason.lower()
        assert "geoffrey" in reason.lower()

    async def test_no_last_name_is_uncertain(self):
        """Last name not on page at all → uncertain."""
        html = "<html><body>Welcome to the Smith Lab.</body></html>"
        certain, reason = await verify_lab_url(
            _make_mock_session(html), "http://smithlab.ucsd.edu/", "Eric Chang"
        )
        assert certain is False
        assert "chang" in reason.lower()

    async def test_http_error_is_uncertain(self):
        """HTTP non-200 → uncertain."""
        certain, reason = await verify_lab_url(
            _make_mock_session("", status=404), "http://broken.ucsd.edu/", "Eric Chang"
        )
        assert certain is False
        assert "404" in reason


# ---------- resolve + verify (live network) ----------

@pytest.mark.asyncio
@pytest.mark.network
class TestResolveAndVerifyLive:
    """Live tests. Run with: pytest -m network tests/test_stage2_resolve.py -v"""

    async def test_bioengineering_resolves_and_verifies(self):
        """Profile → 'Subramaniam Research' link → genome.ucsd.edu → certain."""
        profile = "https://bioengineering.ucsd.edu/content/shankar-subramaniam"
        async with aiohttp.ClientSession() as session:
            resolved = await resolve_lab_url(session, profile, name="Shankar Subramaniam")
            assert "genome" in resolved.lower(), f"Expected genome.ucsd.edu, got: {resolved}"
            certain, reason = await verify_lab_url(session, resolved, "Shankar Subramaniam")
        assert certain is True, f"Expected certain but got: {reason}"

    async def test_jacobsschool_resolves_and_verifies(self):
        """Profile → 'Website' link → genome.ucsd.edu → certain."""
        profile = "https://jacobsschool.ucsd.edu/faculty/profile?id=19"
        async with aiohttp.ClientSession() as session:
            resolved = await resolve_lab_url(session, profile, name="Shankar Subramaniam")
            assert "genome" in resolved.lower(), f"Expected genome.ucsd.edu, got: {resolved}"
            certain, reason = await verify_lab_url(session, resolved, "Shankar Subramaniam")
        assert certain is True, f"Expected certain but got: {reason}"

    async def test_real_lab_stays_unchanged(self):
        """An actual lab site should not be re-resolved."""
        url = "https://genome.ucsd.edu/"
        async with aiohttp.ClientSession() as session:
            resolved = await resolve_lab_url(session, url, name="Shankar Subramaniam")
        assert resolved == url
