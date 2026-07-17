"""Parse the quiz text format into Question rows.

Rows are `$$$`-delimited (preferred) or CSV. The header names the columns; a
`section` column is optional. A row is treated as open-ended (`qa`) when the
header has an `answer` column and no `option*` columns, otherwise MCQ."""
from __future__ import annotations

from typing import List

from .store import Question


def _parse_csv_line(line: str) -> List[str]:
    out: List[str] = []
    cur = ""
    in_quotes = False
    i = 0
    while i < len(line):
        ch = line[i]
        if in_quotes:
            if ch == '"':
                if i + 1 < len(line) and line[i + 1] == '"':
                    cur += '"'
                    i += 1
                else:
                    in_quotes = False
            else:
                cur += ch
        elif ch == '"':
            in_quotes = True
        elif ch == ",":
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
        i += 1
    out.append(cur.strip())
    return out


def _rows(text: str) -> List[List[str]]:
    lines = [ln for ln in text.replace("\r\n", "\n").split("\n") if ln.strip()]
    if not lines:
        return []
    if "$$$" in lines[0]:
        return [[c.strip() for c in ln.split("$$$")] for ln in lines]
    return [_parse_csv_line(ln) for ln in lines]


def _to_int(value: str):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_questions(text: str) -> List[Question]:
    rows = _rows(text or "")
    if not rows:
        return []
    header = [(h or "").strip().lower() for h in rows[0]]
    has_section = bool(header) and header[0] == "section"
    has_option = any(c.startswith("option") for c in header)
    is_qa = "answer" in header and not has_option

    result: List[Question] = []
    for row in rows[1:]:
        cells = list(row) if has_section else ["main", *row]
        while len(cells) < 8:
            cells.append("")
        qnum = _to_int(cells[1])
        if qnum is None:
            continue
        section = cells[0].strip() if cells[0] and cells[0].strip() else "main"
        if is_qa:
            result.append(Question(section=section, question_number=str(qnum), qtype="qa",
                                    question=cells[2], answer=cells[3]))
        else:
            result.append(Question(section=section, question_number=str(qnum), qtype="mcq",
                                    question=cells[2], options=[cells[3], cells[4], cells[5], cells[6]],
                                    correct_option=_to_int(cells[7])))
    return result
