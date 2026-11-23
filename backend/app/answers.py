"""Exact parsing of equation answers with SymPy.

Accepted, all meaning the same value: ``3``, ``3.0``, ``3,0`` (Russian/Kazakh decimal comma),
``x = 3``, ``x=3.0``, ``х = 3`` (Cyrillic х), ``3 = x``, ``6/2``, ``1 200`` (thousands spaces)
and a leading minus. Values are compared exactly, never as floats, so ``3.0000001`` is simply
incorrect.

Security: student text is never passed to ``sympify``/``parse_expr`` (they call ``eval``).
It must first match a strict ASCII-digit pattern; SymPy then receives only a validated numeric
literal (``Rational``) and a fixed equation ``Eq(x, value)`` that it solves for x.
"""

import re
import unicodedata
from fractions import Fraction

from sympy import Eq, Rational, Symbol, solve

MAX_ANSWER_LENGTH = 40
X = Symbol("x")

# ASCII digits only: \d would also match other Unicode digits that Rational cannot read.
NUMBER = re.compile(r"[+-]?[0-9]+(?:[.,][0-9]+)?")
RATIO = re.compile(r"([+-]?[0-9]+)\s*/\s*([+-]?[0-9]+)")
GROUPED = re.compile(r"[+-]?[0-9]{1,3}(?: [0-9]{3})+(?:[.,][0-9]+)?")
# "x = …" or "… = x", with a Latin or Cyrillic x.
X_LEFT = re.compile(r"[xXхХ]\s*=\s*(.+)")
X_RIGHT = re.compile(r"(.+?)\s*=\s*[xXхХ]")


def _normalize(answer: str) -> str:
    text = unicodedata.normalize("NFKC", answer)
    text = text.replace("−", "-").replace("–", "-")  # minus sign, en dash
    text = re.sub(r"[   ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _literal(text: str) -> Rational | None:
    """A validated numeric literal -> exact SymPy Rational (or None)."""
    if GROUPED.fullmatch(text):
        text = text.replace(" ", "")
    if NUMBER.fullmatch(text):
        return Rational(text.replace(",", "."))
    ratio = RATIO.fullmatch(text)
    if ratio:
        numerator, denominator = (int(part) for part in ratio.groups())
        return None if denominator == 0 else Rational(numerator, denominator)
    return None


def parse_equation_answer(answer: str) -> Fraction | None:
    """The value of x the student gave, or None when the input is not a number for x."""
    text = _normalize(answer)
    if not text or len(text) > MAX_ANSWER_LENGTH:
        return None
    match = X_LEFT.fullmatch(text) or X_RIGHT.fullmatch(text)
    if match:
        value = _literal(match.group(1).strip())
        if value is None:
            return None
        # The student wrote an equation for x: let SymPy solve it exactly.
        (value,) = solve(Eq(X, value), X)
    else:
        value = _literal(text)
        if value is None:
            return None
    return Fraction(int(value.p), int(value.q))


FRACTION_PATTERN = re.compile(r"([+-]?[0-9]+)\s*/\s*([+-]?[0-9]+)")


def parse_answer(answer: str, topic: str) -> Fraction | None:
    """Fractions accept a/b; equations accept x = 3, 3, 3.0 … (see answers.py). Exact math."""
    answer = answer.strip()
    if topic == "equations":
        return parse_equation_answer(answer)
    match = FRACTION_PATTERN.fullmatch(answer)
    if match is None:
        return None
    numerator, denominator = map(int, match.groups())
    return None if denominator == 0 else Fraction(numerator, denominator)
