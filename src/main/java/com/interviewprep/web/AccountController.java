package com.interviewprep.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewprep.model.User;
import com.interviewprep.repo.UserRepository;
import com.interviewprep.security.AuthUser;
import com.interviewprep.service.Providers;

@RestController
@RequestMapping("/api")
public class AccountController {

    private final UserRepository users;

    public AccountController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/me")
    public Dto.MeResponse me(@AuthUser User user) {
        return new Dto.MeResponse(user.getEmail(), user.getProvider(), user.getApiKey() != null);
    }

    @PatchMapping("/account")
    public Dto.MeResponse update(@AuthUser User user, @RequestBody Dto.AccountUpdateRequest body) {
        if (body.provider() != null && Providers.ALL.contains(body.provider())) {
            user.setProvider(body.provider());
        }
        if (body.apiKey() != null) {
            user.setApiKey(body.apiKey().isBlank() ? null : body.apiKey());
        }
        users.save(user);
        return new Dto.MeResponse(user.getEmail(), user.getProvider(), user.getApiKey() != null);
    }
}
