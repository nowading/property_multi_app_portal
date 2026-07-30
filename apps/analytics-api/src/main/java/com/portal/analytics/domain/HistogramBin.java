package com.portal.analytics.domain;

/**
 * A single histogram bin for price distribution visualization.
 *
 * @param range      display label for the price range (e.g. "$100k-$200k")
 * @param count      number of properties in this bin
 * @param rangeStart lower bound of the price range
 * @param rangeEnd   upper bound of the price range
 */
public record HistogramBin(
        String range,
        int count,
        double rangeStart,
        double rangeEnd
) {
}