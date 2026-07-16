package com.interviewprep.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class LlmService {

    private static final Map<String, String> MODELS = Map.of(
            "gemini", "gemini-2.5-flash",
            "openai", "gpt-4o",
            "anthropic", "claude-sonnet-5");

    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public LlmService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public void stream(String provider, String apiKey, String prompt, Consumer<String> onChunk) {
        String p = MODELS.containsKey(provider) ? provider : "gemini";
        String model = MODELS.get(p);
        HttpRequest request = buildRequest(p, model, apiKey, prompt);
        try {
            HttpResponse<java.io.InputStream> response =
                    client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() >= 400) {
                throw new GenerationException(errorMessage(response));
            }
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    String payload = line.substring(5).trim();
                    if (payload.isEmpty() || payload.equals("[DONE]")) {
                        continue;
                    }
                    String text;
                    try {
                        text = delta(p, mapper.readTree(payload));
                    } catch (Exception ignored) {
                        continue;
                    }
                    if (!text.isEmpty()) {
                        onChunk.accept(text);
                    }
                }
            }
        } catch (GenerationException e) {
            throw e;
        } catch (Exception e) {
            throw new GenerationException("Could not reach the provider");
        }
    }

    private HttpRequest buildRequest(String provider, String model, String apiKey, String prompt) {
        try {
            String url;
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .timeout(Duration.ofSeconds(300))
                    .header("Content-Type", "application/json");
            Object body;
            switch (provider) {
                case "openai" -> {
                    url = "https://api.openai.com/v1/chat/completions";
                    builder.header("Authorization", "Bearer " + apiKey);
                    body = Map.of(
                            "model", model,
                            "stream", true,
                            "max_tokens", 16384,
                            "messages", List.of(Map.of("role", "user", "content", prompt)));
                }
                case "anthropic" -> {
                    url = "https://api.anthropic.com/v1/messages";
                    builder.header("x-api-key", apiKey);
                    builder.header("anthropic-version", "2023-06-01");
                    body = Map.of(
                            "model", model,
                            "stream", true,
                            "max_tokens", 32000,
                            "messages", List.of(Map.of("role", "user", "content", prompt)));
                }
                default -> {
                    url = "https://generativelanguage.googleapis.com/v1beta/models/"
                            + URLEncoder.encode(model, StandardCharsets.UTF_8)
                            + ":streamGenerateContent?alt=sse";
                    builder.header("x-goog-api-key", apiKey);
                    var generationConfig = new java.util.HashMap<String, Object>();
                    generationConfig.put("temperature", 0.6);
                    generationConfig.put("maxOutputTokens", 32768);
                    if (model.contains("2.5")) {
                        generationConfig.put("thinkingConfig", Map.of("thinkingBudget", 0));
                    }
                    body = Map.of(
                            "contents", List.of(Map.of("role", "user",
                                    "parts", List.of(Map.of("text", prompt)))),
                            "generationConfig", generationConfig);
                }
            }
            String json = mapper.writeValueAsString(body);
            return builder.uri(URI.create(url))
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
        } catch (Exception e) {
            throw new GenerationException("Could not build request");
        }
    }

    private String delta(String provider, JsonNode node) {
        switch (provider) {
            case "openai" -> {
                JsonNode content = node.path("choices").path(0).path("delta").path("content");
                return content.isTextual() ? content.asText() : "";
            }
            case "anthropic" -> {
                if ("content_block_delta".equals(node.path("type").asText())) {
                    return node.path("delta").path("text").asText("");
                }
                return "";
            }
            default -> {
                JsonNode parts = node.path("candidates").path(0).path("content").path("parts");
                StringBuilder sb = new StringBuilder();
                if (parts.isArray()) {
                    for (JsonNode part : parts) {
                        sb.append(part.path("text").asText(""));
                    }
                }
                return sb.toString();
            }
        }
    }

    private String errorMessage(HttpResponse<java.io.InputStream> response) {
        try {
            byte[] raw = response.body().readAllBytes();
            JsonNode node = mapper.readTree(raw);
            String msg = node.path("error").path("message").asText("");
            return msg.isEmpty() ? "Generation failed" : msg;
        } catch (Exception e) {
            return "Generation failed";
        }
    }
}
