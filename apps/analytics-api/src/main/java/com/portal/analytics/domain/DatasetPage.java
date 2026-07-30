package com.portal.analytics.domain;

import java.util.List;

/**
 * Paginated dataset response.
 *
 * @param rows      property rows for the current page
 * @param total     total number of rows in the dataset
 * @param page      current page number (1-based)
 * @param pageSize  number of rows per page
 */
public record DatasetPage(
        List<PropertyRow> rows,
        long total,
        int page,
        int pageSize
) {
}