package com.interviewprep.security;

import java.util.Date;

import org.springframework.stereotype.Service;

import com.interviewprep.config.AppSecrets;

import io.jsonwebtoken.Jwts;

@Service
public class JwtService {

    private final AppSecrets secrets;

    public JwtService(AppSecrets secrets) {
        this.secrets = secrets;
    }

    public String createToken(String subject) {
        long now = System.currentTimeMillis();
        Date iat = new Date(now);
        Date exp = new Date(now + secrets.jwtExpireMinutes() * 60_000L);
        return Jwts.builder()
                .subject(subject)
                .issuedAt(iat)
                .expiration(exp)
                .signWith(secrets.jwtKey())
                .compact();
    }

    public String parseSubject(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(secrets.jwtKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();
        } catch (Exception e) {
            return null;
        }
    }
}
