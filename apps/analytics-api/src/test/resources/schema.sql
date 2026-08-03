CREATE TABLE properties (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    square_footage  DECIMAL(8,0)    NOT NULL,
    bedrooms        INT             NOT NULL,
    bathrooms       DECIMAL(3,1)    NOT NULL,
    year_built      INT             NOT NULL,
    lot_size        DECIMAL(10,0)   NOT NULL,
    distance_to_city_center DECIMAL(5,2),
    school_rating   DECIMAL(2,1),
    price           DECIMAL(12,2)   NOT NULL
);

CREATE INDEX idx_bedrooms ON properties (bedrooms);
CREATE INDEX idx_year_built ON properties (year_built);
CREATE INDEX idx_price ON properties (price);
CREATE INDEX idx_distance_to_city_center ON properties (distance_to_city_center);
CREATE INDEX idx_school_rating ON properties (school_rating);
CREATE INDEX idx_bedrooms_year_built ON properties (bedrooms, year_built);
CREATE INDEX idx_price_bedrooms ON properties (price, bedrooms);