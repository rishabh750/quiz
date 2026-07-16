package com.interviewprep.web;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class Dto {

    private Dto() {
    }

    public record RegisterRequest(String email, String password, String provider,
                                  @JsonProperty("api_key") String apiKey) {
    }

    public record LoginRequest(String email, String password) {
    }

    public record TokenResponse(@JsonProperty("access_token") String accessToken,
                                @JsonProperty("token_type") String tokenType) {
        public TokenResponse(String accessToken) {
            this(accessToken, "bearer");
        }
    }

    public record MeResponse(String email, String provider,
                             @JsonProperty("has_api_key") boolean hasApiKey) {
    }

    public record AccountUpdateRequest(String provider, @JsonProperty("api_key") String apiKey) {
    }

    public record UploadRequest(String filename, String content) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QuestionResponse(String section, String questionNumber, String question,
                                   String type, List<String> options, Integer correctOption,
                                   String answer) {
    }

    public record NotesResponse(boolean exists, String content) {
    }

    public record AnswerRequest(Object questionNumber, Object candidateAnswer, Integer marks) {
    }

    public record AnswerResponse(String questionNumber, String candidateAnswer, int marks) {
    }

    public record ResetRequest(List<String> questionNumbers) {
    }

    public record GenerateRequest(String prompt, String provider) {
    }

    public record PublicKeyResponse(String publicKey) {
    }
}
