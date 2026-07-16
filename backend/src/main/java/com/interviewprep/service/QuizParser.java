package com.interviewprep.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class QuizParser {

    public record Parsed(String section, int questionNumber, String qtype, String question,
                         List<String> options, Integer correctOption, String answer) {
    }

    public List<Parsed> parse(String text) {
        List<List<String>> rows = rows(text == null ? "" : text);
        List<Parsed> result = new ArrayList<>();
        if (rows.isEmpty()) {
            return result;
        }
        List<String> header = rows.get(0);
        List<String> cells = new ArrayList<>();
        for (String h : header) {
            cells.add(h == null ? "" : h.trim().toLowerCase());
        }
        boolean hasSection = !cells.isEmpty() && cells.get(0).equals("section");
        boolean hasOption = cells.stream().anyMatch(c -> c.startsWith("option"));
        boolean isQa = cells.contains("answer") && !hasOption;

        for (int r = 1; r < rows.size(); r++) {
            List<String> c = new ArrayList<>(rows.get(r));
            if (!hasSection) {
                c.add(0, "main");
            }
            while (c.size() < 8) {
                c.add("");
            }
            String section = (c.get(0) != null && !c.get(0).trim().isEmpty()) ? c.get(0).trim() : "main";
            Integer qnum = parseInt(c.get(1));
            if (qnum == null) {
                continue;
            }
            if (isQa) {
                result.add(new Parsed(section, qnum, "qa", c.get(2), null, null, c.get(3)));
            } else {
                Integer correct = parseInt(c.get(7));
                result.add(new Parsed(section, qnum, "mcq", c.get(2),
                        List.of(c.get(3), c.get(4), c.get(5), c.get(6)), correct, null));
            }
        }
        return result;
    }

    private List<List<String>> rows(String text) {
        List<List<String>> out = new ArrayList<>();
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\r?\n")) {
            if (!line.trim().isEmpty()) {
                lines.add(line);
            }
        }
        if (lines.isEmpty()) {
            return out;
        }
        boolean delimited = lines.get(0).contains("$$$");
        for (String line : lines) {
            if (delimited) {
                List<String> cells = new ArrayList<>();
                for (String part : line.split("\\$\\$\\$", -1)) {
                    cells.add(part.trim());
                }
                out.add(cells);
            } else {
                out.add(parseCsvLine(line));
            }
        }
        return out;
    }

    private List<String> parseCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        int i = 0;
        while (i < line.length()) {
            char ch = line.charAt(i);
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur.append(ch);
                }
            } else if (ch == '"') {
                inQuotes = true;
            } else if (ch == ',') {
                out.add(cur.toString().trim());
                cur.setLength(0);
            } else {
                cur.append(ch);
            }
            i++;
        }
        out.add(cur.toString().trim());
        return out;
    }

    private Integer parseInt(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
