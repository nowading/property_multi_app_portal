package com.portal.analytics.domain;

/**
 * Box plot statistics for one bedroom-count group.
 *
 * @param bedrooms bedroom count for this group
 * @param min      minimum price in the group
 * @param q1       first quartile (25th percentile)
 * @param median   median price (50th percentile)
 * @param q3       third quartile (75th percentile)
 * @param max      maximum price in the group
 * @param count    number of properties in this group
 */
public record BoxPlotGroup(
        int bedrooms,
        double min,
        double q1,
        double median,
        double q3,
        double max,
        int count
) {
}