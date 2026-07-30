package com.portal.analytics.domain;

import java.util.List;

/**
 * Port for accessing the housing dataset.
 *
 * <p>The default adapter loads housing.csv from resources into an
 * in-memory list and exposes query/filter/pagination methods.
 */
public interface DatasetPort {

    /**
     * Get all property rows.
     *
     * @return unfiltered list of all properties
     */
    List<PropertyRow> findAll();

    /**
     * Get property rows matching the given filters.
     *
     * @param filters filter criteria
     * @return filtered list of properties
     */
    List<PropertyRow> findByFilters(StatsFilters filters);

    /**
     * Get a paginated subset of property rows.
     *
     * @param filters  filter criteria
     * @param page     page number (1-based)
     * @param pageSize rows per page
     * @return paginated response
     */
    DatasetPage findPage(StatsFilters filters, int page, int pageSize);

    /**
     * Get total count of rows matching the given filters.
     *
     * @param filters filter criteria
     * @return count of matching rows
     */
    long countByFilters(StatsFilters filters);
}