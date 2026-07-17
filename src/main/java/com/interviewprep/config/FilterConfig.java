package com.interviewprep.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewprep.crypto.PayloadCipherFilter;
import com.interviewprep.repo.UserRepository;
import com.interviewprep.security.JwtAuthFilter;
import com.interviewprep.security.JwtService;

@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<PayloadCipherFilter> cipherFilter(AppSecrets secrets, ObjectMapper mapper) {
        FilterRegistrationBean<PayloadCipherFilter> bean =
                new FilterRegistrationBean<>(new PayloadCipherFilter(secrets, mapper));
        bean.addUrlPatterns("/api/*");
        bean.setOrder(0);
        return bean;
    }

    @Bean
    public FilterRegistrationBean<JwtAuthFilter> jwtFilter(JwtService jwtService, UserRepository users) {
        FilterRegistrationBean<JwtAuthFilter> bean =
                new FilterRegistrationBean<>(new JwtAuthFilter(jwtService, users));
        bean.addUrlPatterns("/api/*");
        bean.setOrder(10);
        return bean;
    }
}
