import re


def _parse_csv_line(line: str):
    out = []
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
            out.append(cur)
            cur = ""
        else:
            cur += ch
        i += 1
    out.append(cur)
    return [c.strip() for c in out]


def _rows(text: str):
    lines = [l for l in re.split(r"\r?\n", text) if l.strip() != ""]
    if not lines:
        return []
    if "$$$" in lines[0]:
        return [[c.strip() for c in l.split("$$$")] for l in lines]
    return [_parse_csv_line(l) for l in lines]


def parse_questions(text: str):
    rows = _rows(text or "")
    if not rows:
        return []
    header = rows[0]
    cells = [(h or "").strip().lower() for h in header]
    has_section = len(cells) > 0 and cells[0] == "section"
    is_qa = ("answer" in cells) and not any(c.startswith("option") for c in cells)
    result = []
    for r in rows[1:]:
        c = r if has_section else ["main", *r]
        c = c + [""] * (8 - len(c))
        section = c[0].strip() if c[0] and c[0].strip() else "main"
        try:
            qnum = int(str(c[1]).strip())
        except (ValueError, TypeError):
            continue
        base = {"section": section, "question_number": qnum, "question": c[2]}
        if is_qa:
            base.update({"qtype": "qa", "answer": c[3]})
        else:
            correct = None
            try:
                correct = int(str(c[7]).strip())
            except (ValueError, TypeError):
                correct = None
            base.update(
                {
                    "qtype": "mcq",
                    "options": [c[3], c[4], c[5], c[6]],
                    "correct_option": correct,
                }
            )
        result.append(base)
    return result
