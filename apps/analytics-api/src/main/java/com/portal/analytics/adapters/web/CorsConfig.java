package com.portal.analytics.adapters.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * CORS configuration for the analytics REST API.
 *
 * <p>Allows the Next.js portal (default {@code http://localhost:3000}) to
 * call this service from both React Server Components (server-side fetch)
 * and client-side components (browser). Override via the
 * {@code analytics.cors.allowed-origins} property for multi-environment
 * deployments.
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter(
            @Value("${analytics.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
            List<String> allowedOrigins
    ) {
        CorsConfiguration config = new CorsConfiguration();

        if (allowedOrigins.isEmpty() || allowedOrigins.contains("*")) {
            config.addAllowedOriginPattern("*");
        } else {
            config.setAllowedOriginPatterns(allowedOrigins);
        }

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
