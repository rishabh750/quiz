package com.interviewprep.crypto;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewprep.config.AppSecrets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import javax.crypto.SecretKey;

public class PayloadCipherFilter extends OncePerRequestFilter {

    public static final String KEY_HEADER = "X-Enc-Key";
    public static final String ENC_MARKER = "X-Enc";
    public static final String AES_KEY_ATTR = "aesKey";

    private final AppSecrets secrets;
    private final ObjectMapper mapper;

    public PayloadCipherFilter(AppSecrets secrets, ObjectMapper mapper) {
        this.secrets = secrets;
        this.mapper = mapper;
    }

    public record Envelope(String iv, String d) {
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String wrappedKey = request.getHeader(KEY_HEADER);
        if (wrappedKey == null || wrappedKey.isBlank()) {
            chain.doFilter(request, response);
            return;
        }

        SecretKey aesKey;
        try {
            aesKey = RsaCrypto.unwrapAesKey(secrets.rsaPrivateKey(), wrappedKey);
        } catch (Exception e) {
            plainError(response, 400, "Bad encryption key");
            return;
        }
        request.setAttribute(AES_KEY_ATTR, aesKey);

        HttpServletRequest effectiveRequest = request;
        byte[] raw = request.getInputStream().readAllBytes();
        if (raw.length > 0) {
            try {
                Envelope env = mapper.readValue(raw, Envelope.class);
                byte[] plain = AesGcm.decrypt(aesKey,
                        Base64.getDecoder().decode(env.iv()),
                        Base64.getDecoder().decode(env.d()));
                effectiveRequest = new CachedBodyRequestWrapper(request, plain);
            } catch (Exception e) {
                plainError(response, 400, "Bad encrypted payload");
                return;
            }
        }

        if ("/api/generate".equals(request.getRequestURI())) {
            chain.doFilter(effectiveRequest, response);
            return;
        }

        BufferingResponseWrapper wrapper = new BufferingResponseWrapper(response);
        chain.doFilter(effectiveRequest, wrapper);

        byte[] body = wrapper.getBuffer();
        byte[] iv = AesGcm.randomIv();
        byte[] ct = AesGcm.encrypt(aesKey, iv, body);
        String envelope = mapper.writeValueAsString(new Envelope(
                Base64.getEncoder().encodeToString(iv),
                Base64.getEncoder().encodeToString(ct)));
        byte[] out = envelope.getBytes(StandardCharsets.UTF_8);

        response.setContentType("application/json");
        response.setHeader(ENC_MARKER, "1");
        response.setContentLength(out.length);
        response.getOutputStream().write(out);
        response.getOutputStream().flush();
    }

    private void plainError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"detail\":\"" + message + "\"}");
    }
}
