package com.interviewprep.config;

import java.net.URI;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        String raw = firstNonBlank(
                System.getenv("DATABASE_URL"),
                System.getenv("POSTGRES_URL"),
                "postgresql://interviewprep:interviewprep@localhost:5432/interviewprep");

        HikariConfig cfg = new HikariConfig();
        if (raw.startsWith("jdbc:")) {
            cfg.setJdbcUrl(raw);
            String user = System.getenv("DB_USERNAME");
            String pass = System.getenv("DB_PASSWORD");
            if (user != null) {
                cfg.setUsername(user);
            }
            if (pass != null) {
                cfg.setPassword(pass);
            }
        } else {
            URI uri = URI.create(raw.replaceFirst("^postgres(ql)?(\\+[a-z0-9]+)?://", "postgresql://"));
            String userInfo = uri.getUserInfo();
            String user = "";
            String pass = "";
            if (userInfo != null) {
                int idx = userInfo.indexOf(':');
                user = idx >= 0 ? userInfo.substring(0, idx) : userInfo;
                pass = idx >= 0 ? userInfo.substring(idx + 1) : "";
            }
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String query = uri.getRawQuery() != null ? "?" + uri.getRawQuery() : "";
            cfg.setJdbcUrl("jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getRawPath() + query);
            cfg.setUsername(user);
            cfg.setPassword(pass);
        }
        cfg.setMaximumPoolSize(Integer.parseInt(firstNonBlank(System.getenv("DB_POOL_MAX"), "5")));
        cfg.setPoolName("interviewprep");
        return new HikariDataSource(cfg);
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return "";
    }
}
