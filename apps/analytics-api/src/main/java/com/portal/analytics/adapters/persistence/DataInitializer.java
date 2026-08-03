package com.portal.analytics.adapters.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Initializes the properties table with data from housing.csv on first run.
 *
 * <p>This component checks if the database is empty and, if so, loads data
 * from the CSV file into MySQL via {@link CsvDataLoader}. Subsequent startups
 * skip initialization.</p>
 *
 * <p>Disabled under the {@code test} profile so tests rely on the H2
 * {@code data.sql} script instead of polluting the Spring context.</p>
 */
@Component
@Profile("!test")
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final PropertyRepository propertyRepository;

    public DataInitializer(PropertyRepository propertyRepository) {
        this.propertyRepository = propertyRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long existingCount = propertyRepository.count();
        if (existingCount > 0) {
            log.info("Database already contains {} property records — skipping CSV import", existingCount);
            return;
        }

        log.info("Database is empty — importing data from {}", CsvDataLoader.DEFAULT_RESOURCE);
        List<PropertyEntity> entities;
        try {
            entities = CsvDataLoader.loadEntities(CsvDataLoader.DEFAULT_RESOURCE);
        } catch (IllegalStateException e) {
            log.error("Failed to load CSV data from classpath resource: {}", CsvDataLoader.DEFAULT_RESOURCE, e);
            throw new RuntimeException("Failed to load CSV data: " + e.getMessage(), e);
        }

        try {
            propertyRepository.saveAll(entities);
            log.info("Successfully imported {} property records from CSV", entities.size());
        } catch (DataAccessException e) {
            log.error("Failed to persist CSV data to database ({} records loaded)", entities.size(), e);
            throw new RuntimeException("Failed to persist data to database: " + e.getMessage(), e);
        }
    }
}
