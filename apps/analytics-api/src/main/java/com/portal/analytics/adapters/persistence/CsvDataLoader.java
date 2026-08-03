package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.PropertyRow;
import org.springframework.core.io.ClassPathResource;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Shared utility for loading property data from the classpath CSV resource.
 *
 * <p>Centralises the parsing logic used by {@link DataInitializer},
 * {@link CsvDatasetPort} and the persistence tests, so the schema mapping
 * is defined in one place.</p>
 */
public final class CsvDataLoader {

    public static final String DEFAULT_RESOURCE = "data/housing.csv";

    private CsvDataLoader() {
    }

    /**
     * Load CSV rows as JPA entities (used by {@link DataInitializer} and
     * persistence tests).
     */
    public static List<PropertyEntity> loadEntities(String resource) {
        List<PropertyEntity> entities = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(resource).getInputStream(), StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) {
                return entities;
            }
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) {
                    continue;
                }
                try {
                    entities.add(parseEntity(line));
                } catch (NumberFormatException ignored) {
                    // skip malformed rows; logging is delegated to callers
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load CSV from classpath: " + resource, e);
        }
        return entities;
    }

    /**
     * Load CSV rows as domain {@link PropertyRow} (used by {@link CsvDatasetPort}).
     */
    public static List<PropertyRow> loadRows(String resource) {
        List<PropertyRow> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(resource).getInputStream(), StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) {
                return rows;
            }
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) {
                    continue;
                }
                try {
                    rows.add(parseRow(line));
                } catch (NumberFormatException ignored) {
                    // skip malformed rows; logging is delegated to callers
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load CSV from classpath: " + resource, e);
        }
        return rows;
    }

    private static PropertyEntity parseEntity(String line) {
        String[] parts = splitRow(line);
        PropertyEntity entity = new PropertyEntity();
        entity.setId(Integer.parseInt(parts[0].trim()));
        entity.setSquareFootage(Double.parseDouble(parts[1].trim()));
        entity.setBedrooms(Integer.parseInt(parts[2].trim()));
        entity.setBathrooms(Double.parseDouble(parts[3].trim()));
        entity.setYearBuilt(Integer.parseInt(parts[4].trim()));
        entity.setLotSize(Double.parseDouble(parts[5].trim()));
        entity.setDistanceToCityCenter(Double.parseDouble(parts[6].trim()));
        entity.setSchoolRating(Double.parseDouble(parts[7].trim()));
        entity.setPrice(Double.parseDouble(parts[8].trim()));
        return entity;
    }

    private static PropertyRow parseRow(String line) {
        String[] parts = splitRow(line);
        return new PropertyRow(
                Integer.parseInt(parts[0].trim()),
                Double.parseDouble(parts[1].trim()),
                Integer.parseInt(parts[2].trim()),
                Double.parseDouble(parts[3].trim()),
                Integer.parseInt(parts[4].trim()),
                Double.parseDouble(parts[5].trim()),
                Double.parseDouble(parts[6].trim()),
                Double.parseDouble(parts[7].trim()),
                Double.parseDouble(parts[8].trim())
        );
    }

    private static String[] splitRow(String line) {
        String[] parts = line.split(",");
        if (parts.length < 9) {
            throw new NumberFormatException("Expected 9 columns, got " + parts.length);
        }
        return parts;
    }
}
