package com.interviewprep.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.interviewprep.crypto.AtRestKey;

import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;

@Component
public class AppSecrets {

    @Value("${app.secret-dir}")
    private String secretDir;

    @Value("${app.jwt-expire-minutes}")
    private long jwtExpireMinutes;

    private SecretKey jwtKey;
    private KeyPair rsaKeyPair;
    private String rsaPublicKeyBase64;

    @PostConstruct
    void init() {
        String encKey = System.getenv("APP_ENCRYPTION_KEY");
        if (isBlank(encKey)) {
            encKey = persistedSecret("encryption.key", AppSecrets::randomBase64);
        }
        AtRestKey.set(new SecretKeySpec(sha256(encKey), "AES"));

        String jwtSecret = System.getenv("JWT_SECRET");
        if (isBlank(jwtSecret)) {
            jwtSecret = encKey;
        }
        this.jwtKey = Keys.hmacShaKeyFor(sha256(jwtSecret));

        this.rsaKeyPair = generateRsa();
        this.rsaPublicKeyBase64 = Base64.getEncoder().encodeToString(rsaKeyPair.getPublic().getEncoded());
    }

    public SecretKey jwtKey() {
        return jwtKey;
    }

    public long jwtExpireMinutes() {
        return jwtExpireMinutes;
    }

    public PrivateKey rsaPrivateKey() {
        return rsaKeyPair.getPrivate();
    }

    public String rsaPublicKeyBase64() {
        return rsaPublicKeyBase64;
    }

    private String persistedSecret(String name, java.util.function.Supplier<String> generator) {
        try {
            Path dir = Path.of(secretDir);
            Path file = dir.resolve(name);
            if (Files.exists(file)) {
                String value = Files.readString(file).trim();
                if (!value.isEmpty()) {
                    return value;
                }
            }
            Files.createDirectories(dir);
            String value = generator.get();
            Files.writeString(file, value);
            return value;
        } catch (Exception e) {
            return generator.get();
        }
    }

    private static KeyPair generateRsa() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            return gen.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Could not generate RSA key pair", e);
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String randomBase64() {
        byte[] b = new byte[32];
        new SecureRandom().nextBytes(b);
        return Base64.getUrlEncoder().encodeToString(b);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
