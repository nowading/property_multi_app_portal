package com.portal.analytics.adapters.web;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

import java.util.List;

/**
 * Registers the {@link InternalAuthFilter} with the embedded servlet container,
 * explicitly binding it to the {@code /api/*} and {@code /actuator/*} URL
 * patterns so the filter chain is fully predictable and Actuator health
 * endpoints can be exempted at the registration level.
 *
 * <p>Defining a {@link FilterRegistrationBean} takes precedence over Spring
 * Boot's default auto-registration of {@code @Component} filters, so this
 * class is the single source of truth for how the filter is wired into the
 * chain. The actual token validation and exempt-path logic still live in
 * {@link InternalAuthFilter}.
 */
@Configuration
public class InternalAuthFilterConfig {

    /**
     * URL patterns the filter is registered for. {@code /actuator/*} is included
     * so the filter has visibility, but {@link InternalAuthFilter#shouldNotFilter}
     * exempts the specific health/info/prometheus sub-paths.
     */
    private static final List<String> URL_PATTERNS = List.of("/api/*", "/actuator/*", "/error");

    @Bean
    public FilterRegistrationBean<InternalAuthFilter> internalAuthFilterRegistration(
            InternalAuthFilter filter
    ) {
        FilterRegistrationBean<InternalAuthFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setUrlPatterns(URL_PATTERNS);
        registration.setName("internalAuthFilter");
        // Run early so the rest of the chain can assume the token is already validated.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return registration;
    }
}
