package com.interviewprep.service;

import java.util.Set;

public final class Providers {

    public static final Set<String> ALL = Set.of("gemini", "anthropic", "openai");

    private Providers() {
    }

    public static String normalize(String provider) {
        return ALL.contains(provider) ? provider : "gemini";
    }
}
