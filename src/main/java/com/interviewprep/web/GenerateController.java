package com.interviewprep.web;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.SecretKey;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.interviewprep.crypto.AesGcm;
import com.interviewprep.crypto.PayloadCipherFilter;
import com.interviewprep.model.User;
import com.interviewprep.security.ApiException;
import com.interviewprep.security.AuthUser;
import com.interviewprep.service.GenerationException;
import com.interviewprep.service.LlmService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api")
public class GenerateController {

    private final LlmService llm;

    public GenerateController(LlmService llm) {
        this.llm = llm;
    }

    @PostMapping("/generate")
    public ResponseEntity<StreamingResponseBody> generate(@AuthUser User user,
                                                          @RequestBody Dto.GenerateRequest body,
                                                          HttpServletRequest request) {
        if (user.getApiKey() == null || user.getApiKey().isBlank()) {
            throw new ApiException(400, "No API key on your account");
        }
        String provider = body.provider() != null && !body.provider().isBlank()
                ? body.provider() : user.getProvider();
        String apiKey = user.getApiKey();
        String prompt = body.prompt();
        SecretKey aesKey = (SecretKey) request.getAttribute(PayloadCipherFilter.AES_KEY_ATTR);

        StreamingResponseBody stream = (OutputStream out) -> {
            try {
                llm.stream(provider, apiKey, prompt, chunk -> writeChunk(out, aesKey, chunk));
            } catch (GenerationException e) {
                writeChunk(out, aesKey, "[ERROR] " + e.getMessage());
            } finally {
                out.flush();
            }
        };

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .contentType(new MediaType("text", "plain", StandardCharsets.UTF_8));
        if (aesKey != null) {
            builder.header(PayloadCipherFilter.ENC_MARKER, "1");
        }
        return builder.body(stream);
    }

    private void writeChunk(OutputStream out, SecretKey aesKey, String text) {
        try {
            byte[] payload;
            if (aesKey != null) {
                byte[] iv = AesGcm.randomIv();
                byte[] ct = AesGcm.encrypt(aesKey, iv, text.getBytes(StandardCharsets.UTF_8));
                byte[] framed = new byte[iv.length + ct.length];
                System.arraycopy(iv, 0, framed, 0, iv.length);
                System.arraycopy(ct, 0, framed, iv.length, ct.length);
                payload = (Base64.getEncoder().encodeToString(framed) + "\n").getBytes(StandardCharsets.UTF_8);
            } else {
                payload = text.getBytes(StandardCharsets.UTF_8);
            }
            out.write(payload);
            out.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
