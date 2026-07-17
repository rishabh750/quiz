package com.interviewprep.web;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewprep.model.User;
import com.interviewprep.repo.UserRepository;
import com.interviewprep.security.ApiException;
import com.interviewprep.security.JwtService;
import com.interviewprep.service.Providers;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public Dto.TokenResponse register(@RequestBody Dto.RegisterRequest body) {
        if (body.email() == null || body.email().isBlank()) {
            throw new ApiException(400, "Email is required");
        }
        if (body.password() == null || body.password().length() < 6) {
            throw new ApiException(400, "Password must be at least 6 characters");
        }
        String email = body.email().trim().toLowerCase();
        if (users.existsByEmail(email)) {
            throw new ApiException(409, "Email already registered");
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(body.password()));
        user.setProvider(Providers.normalize(body.provider()));
        user.setApiKey(body.apiKey() == null || body.apiKey().isBlank() ? null : body.apiKey());
        users.save(user);
        return new Dto.TokenResponse(jwtService.createToken(user.getId().toString()));
    }

    @PostMapping("/login")
    public Dto.TokenResponse login(@RequestBody Dto.LoginRequest body) {
        String email = body.email() == null ? "" : body.email().trim().toLowerCase();
        User user = users.findByEmail(email).orElse(null);
        if (user == null || !passwordEncoder.matches(body.password(), user.getPasswordHash())) {
            throw new ApiException(401, "Invalid email or password");
        }
        return new Dto.TokenResponse(jwtService.createToken(user.getId().toString()));
    }
}
