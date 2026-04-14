# scraper/tests/test_stage4.py
from stages.stage4_extract import parse_llm_response, build_prompt, EXTRACTION_SCHEMA

def test_parse_valid_json():
    raw = '{"lab_name": "AI Lab", "overview": "We do AI.", "members": [{"name": "Jane", "role": "PI"}]}'
    result = parse_llm_response(raw)
    assert result["lab_name"] == "AI Lab"
    assert result["members"][0]["role"] == "PI"

def test_parse_returns_none_for_empty_object():
    assert parse_llm_response("{}") is None

def test_parse_returns_none_for_invalid_json():
    assert parse_llm_response("not json at all") is None

def test_parse_strips_optional_null_fields():
    raw = '{"lab_name": "AI Lab", "overview": "We do AI.", "members": [{"name": "Jane", "role": "PhD", "email": null, "photo": null}]}'
    result = parse_llm_response(raw)
    member = result["members"][0]
    assert "email" not in member
    assert "photo" not in member

def test_build_prompt_includes_markdown():
    prompt = build_prompt("# Lab\nJane Smith, PhD")
    assert "Jane Smith" in prompt

def test_extraction_schema_has_required_fields():
    assert "lab_name" in EXTRACTION_SCHEMA
    assert "overview" in EXTRACTION_SCHEMA
    assert "members" in EXTRACTION_SCHEMA
