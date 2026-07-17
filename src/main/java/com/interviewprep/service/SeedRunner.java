package com.interviewprep.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.interviewprep.model.User;
import com.interviewprep.repo.UserRepository;

@Component
public class SeedRunner implements ApplicationRunner {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.default-user.email}")
    private String email;

    @Value("${app.default-user.password}")
    private String password;

    @Value("${app.default-user.provider}")
    private String provider;

    @Value("${app.default-user.api-key}")
    private String apiKey;

    public SeedRunner(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank()) {
            return;
        }
        String normalized = email.trim().toLowerCase();
        if (users.existsByEmail(normalized)) {
            return;
        }
        User user = new User();
        user.setEmail(normalized);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setProvider(provider);
        user.setApiKey(apiKey == null || apiKey.isBlank() ? null : apiKey);
        try {
            users.save(user);
        } catch (Exception ignored) {
            // another instance may have seeded concurrently
        }
    }
}
