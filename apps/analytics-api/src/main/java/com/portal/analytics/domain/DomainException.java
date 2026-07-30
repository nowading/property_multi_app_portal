package com.portal.analytics.domain;

/**
 * Exception thrown when domain invariants are violated.
 *
 * <p>This is a runtime exception so it can propagate through the
 * application layer without requiring explicit try-catch. The web
 * adapter catches it and converts to a proper HTTP error response.
 */
public class DomainException extends RuntimeException {

    public DomainException(String message) {
        super(message);
    }

    public DomainException(String message, Throwable cause) {
        super(message, cause);
    }
}