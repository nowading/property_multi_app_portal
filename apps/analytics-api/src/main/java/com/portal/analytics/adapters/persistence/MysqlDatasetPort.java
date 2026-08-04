package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.DatasetPage;
import com.portal.analytics.domain.DatasetPort;
import com.portal.analytics.domain.PropertyRow;
import com.portal.analytics.domain.StatsFilters;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * MySQL-backed implementation of {@link DatasetPort}.
 *
 * <p>Uses Spring Data JPA to query the properties table, replacing the
 * previous CSV-based implementation. This adapter supports dynamic filtering
 * via JPA Specifications and paginated queries via Spring Data Pageable.
 */
@Component
public class MysqlDatasetPort implements DatasetPort {

    private final PropertyRepository propertyRepository;

    public MysqlDatasetPort(PropertyRepository propertyRepository) {
        this.propertyRepository = propertyRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyRow> findAll() {
        return propertyRepository.findAll().stream()
                .map(this::toPropertyRow)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyRow> findByFilters(StatsFilters filters) {
        var spec = PropertySpecifications.fromFilters(filters);
        List<PropertyEntity> entities = spec != null
                ? propertyRepository.findAll(spec)
                : propertyRepository.findAll();
        return entities.stream()
                .map(this::toPropertyRow)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DatasetPage findPage(StatsFilters filters, int page, int pageSize) {
        var spec = PropertySpecifications.fromFilters(filters);
        PageRequest pageable = PageRequest.of(page - 1, pageSize);
        Page<PropertyEntity> pageResult = spec != null
                ? propertyRepository.findAll(spec, pageable)
                : propertyRepository.findAll(pageable);

        List<PropertyRow> rows = pageResult.getContent().stream()
                .map(this::toPropertyRow)
                .toList();

        return new DatasetPage(rows, pageResult.getTotalElements(), page, pageSize);
    }

    @Override
    @Transactional(readOnly = true)
    public long countByFilters(StatsFilters filters) {
        var spec = PropertySpecifications.fromFilters(filters);
        return spec != null
                ? propertyRepository.count(spec)
                : propertyRepository.count();
    }

    /**
     * Convert PropertyEntity to domain PropertyRow.
     */
    private PropertyRow toPropertyRow(PropertyEntity entity) {
        return new PropertyRow(
                entity.getId(),
                entity.getSquareFootage(),
                entity.getBedrooms(),
                entity.getBathrooms(),
                entity.getYearBuilt(),
                entity.getLotSize(),
                entity.getDistanceToCityCenter(),
                entity.getSchoolRating(),
                entity.getPrice()
        );
    }
}
