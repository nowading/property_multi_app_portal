package com.portal.analytics.adapters.web;

import com.portal.analytics.domain.DatasetPage;
import com.portal.analytics.domain.DatasetPort;
import com.portal.analytics.domain.StatsFilters;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for paginated dataset access.
 *
 * <p>Exposes the filtered property dataset for the frontend data table
 * and export features. Delegates to {@link DatasetPort} (backed by
 * {@code housing.csv} in production).
 */
@RestController
@RequestMapping("/api/dataset")
public class DatasetController {

    private static final Logger log = LoggerFactory.getLogger(DatasetController.class);

    /** Default page size for the dataset endpoint. */
    private static final int DEFAULT_PAGE_SIZE = 20;
    /** Maximum page size (upper bound for safety). */
    private static final int MAX_PAGE_SIZE = 200;

    private final DatasetPort datasetPort;

    public DatasetController(DatasetPort datasetPort) {
        this.datasetPort = datasetPort;
    }

    /**
     * Get a paginated subset of the property dataset with optional filters.
     *
     * @param page     1-based page number (defaults to 1)
     * @param pageSize rows per page (defaults to 20, max 200)
     */
    @GetMapping("")
    public ApiResponse<DatasetPage> getDataset(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) Integer bedroomsMin,
            @RequestParam(required = false) Integer bedroomsMax,
            @RequestParam(required = false) Integer yearBuiltMin,
            @RequestParam(required = false) Integer yearBuiltMax,
            @RequestParam(required = false) Double distanceMax,
            @RequestParam(required = false) Double schoolRatingMin,
            @RequestParam(required = false) Double schoolRatingMax,
            @RequestParam(required = false) Double priceMin,
            @RequestParam(required = false) Double priceMax
    ) {
        log.info("Getting dataset page {} with pageSize {}", page, pageSize);

        int safePage = Math.max(1, page);
        int safePageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));

        StatsFilters filters = new StatsFilters(
                bedroomsMin, bedroomsMax,
                yearBuiltMin, yearBuiltMax,
                distanceMax,
                schoolRatingMin, schoolRatingMax,
                priceMin, priceMax
        );

        DatasetPage pageResult = datasetPort.findPage(filters, safePage, safePageSize);
        return ApiResponse.success(pageResult);
    }
}
