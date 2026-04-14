# scraper/tests/test_verify.py
from unittest.mock import patch
from verify import confirm

def test_confirm_yes_proceeds():
    with patch("builtins.input", return_value="y"):
        result = confirm("Found 300 records. Continue?")
    assert result is True

def test_confirm_no_aborts():
    with patch("builtins.input", return_value="n"):
        result = confirm("Found 300 records. Continue?")
    assert result is False

def test_confirm_prints_summary(capsys):
    with patch("builtins.input", return_value="y"):
        confirm("Found 300 records. Continue?")
    captured = capsys.readouterr()
    assert "Found 300 records" in captured.out
