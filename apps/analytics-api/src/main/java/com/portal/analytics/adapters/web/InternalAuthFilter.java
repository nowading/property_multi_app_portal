package com.portal.analytics.adapters.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/**
 * Servlet filter that enforces a shared internal service-to-service auth token
 * on every inbound request, except for known public endpoints (Actuator health
 * probes, static docs, etc.).
 *
 * <p>Configuration:
 * <ul>
 *   <li>Property: {@code internal.service.token} (env: {@code INTERNAL_SERVICE_TOKEN})</li>
 *   <li>If empty, the filter logs a warning at startup and allows all requests
 *       through (development convenience — never do this in production).</li>
 *   <li>If set, the filter requires a matching {@code x-internal-token} header
 *       on every non-health request and returns 401 with the unified
 *       {@link ApiResponse} envelope on failure.</li>
 * </ul>
 *
 * <p>Token comparison uses SHA-256 + {@link MessageDigest#isEqual(byte[], byte[])}
 * which is the Java analog of Python's {@code hmac.compare_digest}: it runs in
 * constant time relative to the token length and avoids early-exit timing leaks.
 */
@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(InternalAuthFilter.class);

    /** Endpoints that do NOT require the internal service token. */
    public static final List<String> EXEMPT_PATH_PREFIXES = List.of(
            "/actuator/health",
            "/actuator/info",
            "/actuator/prometheus",
            "/error"
    );

    private final String expectedToken;
    private final ObjectMapper objectMapper;

    public InternalAuthFilter(
            @Value("${internal.service.token:}") String expectedToken,
            ObjectMapper objectMapper
    ) {
        this.expectedToken = expectedToken == null ? "" : expectedToken;
        this.objectMapper = objectMapper;
        if (this.expectedToken.isEmpty()) {
            log.warn("internal.service.token is not configured. InboundAuthFilter will allow ALL requests "
                    + "without token validation. Set INTERNAL_SERVICE_TOKEN env var to enable service-to-service auth.");
        } else {
            log.info("InboundAuthFilter: x-internal-token header is required on all non-health requests (token length={})",
                    this.expectedToken.length());
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (expectedToken.isEmpty()) {
            // Dev mode: skip filtering entirely so existing test fixtures and dev-only
            // tools can hit the API without supplying a token.
            return true;
        }
        String path = request.getRequestURI();
        for (String prefix : EXEMPT_PATH_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix + "/")) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        if (expectedToken.isEmpty()) {
            // shouldNotFilter() already returned true in this case, but be defensive.
            filterChain.doFilter(request, response);
            return;
        }

        String presented = request.getHeader("x-internal-token");
        if (presented == null || presented.isEmpty()) {
            log.debug("Rejecting request to {} {}: missing x-internal-token header",
                    request.getMethod(), request.getRequestURI());
            writeUnauthorized(response, "Missing internal service token");
            return;
        }

        if (!constantTimeEquals(expectedToken, presented)) {
            log.warn("Rejecting request to {} {}: invalid x-internal-token (presented length={})",
                    request.getMethod(), request.getRequestURI(), presented.length());
            writeUnauthorized(response, "Invalid internal service token");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Constant-time string comparison using SHA-256 digests.
     * Mirrors the contract of Python's {@code hmac.compare_digest}.
     */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] aHash = md.digest(a.getBytes(StandardCharsets.UTF_8));
            md.reset();
            byte[] bHash = md.digest(b.getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(aHash, bHash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required by the JRE; if it's missing, fail closed.
            log.error("SHA-256 algorithm is not available; rejecting request", e);
            return false;
        }
    }

    private void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        ApiResponse<Void> body = ApiResponse.error("UNAUTHORIZED", message);
        byte[] payload = objectMapper.writeValueAsBytes(body);
        response.setContentLength(payload.length);
        response.getOutputStream().write(payload);
        response.getOutputStream().flush();
    }
}
