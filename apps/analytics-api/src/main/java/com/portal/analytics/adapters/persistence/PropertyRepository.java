package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.StatsFilters;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data JPA repository for {@link PropertyEntity}.
 *
 * <p>Provides CRUD operations and dynamic query support via {@link JpaSpecificationExecutor}
 * for building complex filters from {@link StatsFilters}.
 */
@Repository
public interface PropertyRepository extends JpaRepository<PropertyEntity, Integer>,
        JpaSpecificationExecutor<PropertyEntity> {

    /**
     * Find all property records with no filtering.
     */
    List<PropertyEntity> findAll();

    /**
     * Find all property records matching the given Specification.
     */
    List<PropertyEntity> findAll(org.springframework.data.jpa.domain.Specification<PropertyEntity> spec);

    /**
     * Find a page of property records matching the given Specification.
     */
    Page<PropertyEntity> findAll(org.springframework.data.jpa.domain.Specification<PropertyEntity> spec, Pageable pageable);

    /**
     * Count property records matching the given Specification.
     */
    long count(org.springframework.data.jpa.domain.Specification<PropertyEntity> spec);
}
