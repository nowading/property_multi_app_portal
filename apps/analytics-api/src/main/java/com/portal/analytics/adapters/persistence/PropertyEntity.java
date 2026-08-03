package com.portal.analytics.adapters.persistence;

import jakarta.persistence.*;

/**
 * JPA entity mapping to the {@code properties} table.
 */
@Entity
@Table(name = "properties", indexes = {
        @Index(name = "idx_bedrooms", columnList = "bedrooms"),
        @Index(name = "idx_year_built", columnList = "yearBuilt"),
        @Index(name = "idx_price", columnList = "price"),
        @Index(name = "idx_distance_to_city_center", columnList = "distanceToCityCenter"),
        @Index(name = "idx_school_rating", columnList = "schoolRating"),
        @Index(name = "idx_bedrooms_year_built", columnList = "bedrooms, yearBuilt"),
        @Index(name = "idx_price_bedrooms", columnList = "price, bedrooms")
})
public class PropertyEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "square_footage", nullable = false, columnDefinition = "DECIMAL(8,0)")
    private Double squareFootage;

    @Column(name = "bedrooms", nullable = false)
    private Integer bedrooms;

    @Column(name = "bathrooms", nullable = false, columnDefinition = "DECIMAL(3,1)")
    private Double bathrooms;

    @Column(name = "year_built", nullable = false)
    private Integer yearBuilt;

    @Column(name = "lot_size", nullable = false, columnDefinition = "DECIMAL(10,0)")
    private Double lotSize;

    @Column(name = "distance_to_city_center", columnDefinition = "DECIMAL(5,2)")
    private Double distanceToCityCenter;

    @Column(name = "school_rating", columnDefinition = "DECIMAL(2,1)")
    private Double schoolRating;

    @Column(name = "price", nullable = false, columnDefinition = "DECIMAL(12,2)")
    private Double price;

    // Default constructor required by JPA
    public PropertyEntity() {
    }

    // Getters and setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Double getSquareFootage() {
        return squareFootage;
    }

    public void setSquareFootage(Double squareFootage) {
        this.squareFootage = squareFootage;
    }

    public Integer getBedrooms() {
        return bedrooms;
    }

    public void setBedrooms(Integer bedrooms) {
        this.bedrooms = bedrooms;
    }

    public Double getBathrooms() {
        return bathrooms;
    }

    public void setBathrooms(Double bathrooms) {
        this.bathrooms = bathrooms;
    }

    public Integer getYearBuilt() {
        return yearBuilt;
    }

    public void setYearBuilt(Integer yearBuilt) {
        this.yearBuilt = yearBuilt;
    }

    public Double getLotSize() {
        return lotSize;
    }

    public void setLotSize(Double lotSize) {
        this.lotSize = lotSize;
    }

    public Double getDistanceToCityCenter() {
        return distanceToCityCenter;
    }

    public void setDistanceToCityCenter(Double distanceToCityCenter) {
        this.distanceToCityCenter = distanceToCityCenter;
    }

    public Double getSchoolRating() {
        return schoolRating;
    }

    public void setSchoolRating(Double schoolRating) {
        this.schoolRating = schoolRating;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }
}
