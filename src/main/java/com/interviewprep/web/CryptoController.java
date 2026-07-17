package com.interviewprep.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewprep.config.AppSecrets;

@RestController
@RequestMapping("/api")
public class CryptoController {

    private final AppSecrets secrets;

    public CryptoController(AppSecrets secrets) {
        this.secrets = secrets;
    }

    @GetMapping("/crypto/public-key")
    public Dto.PublicKeyResponse publicKey() {
        return new Dto.PublicKeyResponse(secrets.rsaPublicKeyBase64());
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
