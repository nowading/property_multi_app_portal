package com.portal.analytics.adapters.web;

/**
 * Unified API response envelope for all REST endpoints.
 *
 * @param <T> type of the data payload
 */
public record ApiResponse<T>(boolean success, T data, ErrorInfo error) {

    /**
     * Create a successful response with data.
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }

    /**
     * Create an error response.
     */
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, null, new ErrorInfo(code, message));
    }

    /**
     * Error information in the response envelope.
     */
    public record ErrorInfo(String code, String message) {
    }
}