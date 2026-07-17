package com.interviewprep.security;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import org.springframework.web.filter.OncePerRequestFilter;

import com.interviewprep.model.User;
import com.interviewprep.repo.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String USER_ATTR = "authUser";

    private final JwtService jwtService;
    private final UserRepository users;

    public JwtAuthFilter(JwtService jwtService, UserRepository users) {
        this.jwtService = jwtService;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) || isPublic(uri)) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            unauthorized(response, "Not authenticated");
            return;
        }
        String subject = jwtService.parseSubject(header.substring(7).trim());
        User user = null;
        if (subject != null) {
            try {
                user = users.findById(UUID.fromString(subject)).orElse(null);
            } catch (IllegalArgumentException ignored) {
                user = null;
            }
        }
        if (user == null) {
            unauthorized(response, "Invalid token");
            return;
        }
        request.setAttribute(USER_ATTR, user);
        chain.doFilter(request, response);
    }

    private boolean isPublic(String uri) {
        return uri.equals("/api/health")
                || uri.startsWith("/api/auth/")
                || uri.startsWith("/api/crypto/");
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"detail\":\"" + message + "\"}");
    }

    public static Optional<User> current(HttpServletRequest request) {
        Object attr = request.getAttribute(USER_ATTR);
        return attr instanceof User u ? Optional.of(u) : Optional.empty();
    }
}
