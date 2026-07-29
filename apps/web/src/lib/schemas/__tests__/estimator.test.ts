import {
  propertyFeaturesSchema,
  type PropertyFeaturesInput,
} from "../estimator";

const VALID_INPUT: PropertyFeaturesInput = {
  square_footage: "2000",
  bedrooms: "3",
  bathrooms: "2.5",
  year_built: "1990",
  lot_size: "5000",
  distance_to_city_center: "5.5",
  school_rating: "8",
};

describe("propertyFeaturesSchema", () => {
  it("parses a fully valid input into typed numbers", () => {
    const result = propertyFeaturesSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        square_footage: 2000,
        bedrooms: 3,
        bathrooms: 2.5,
        year_built: 1990,
        lot_size: 5000,
        distance_to_city_center: 5.5,
        school_rating: 8,
      });
    }
  });

  it("fails when a required field is empty", () => {
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      square_footage: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "square_footage"
      )?.message;
      expect(msg).toBe("This field is required");
    }
  });

  it("fails when square_footage is below the minimum", () => {
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      square_footage: "50",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "square_footage"
      )?.message;
      expect(msg).toContain("100");
    }
  });

  it("fails when bedrooms exceeds the maximum", () => {
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      bedrooms: "25",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "bedrooms"
      )?.message;
      expect(msg).toContain("20");
    }
  });

  it("fails when school_rating is above 10", () => {
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      school_rating: "11",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "school_rating"
      )?.message;
      expect(msg).toContain("10");
    }
  });

  it("fails when year_built is in the future", () => {
    const nextYear = (new Date().getFullYear() + 1).toString();
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      year_built: nextYear,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "year_built"
      )?.message;
      expect(msg).toContain("Must be between 1800");
    }
  });

  it("fails when a non-numeric string is provided", () => {
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      bedrooms: "abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "bedrooms"
      )?.message;
      expect(msg).toBe("Must be a valid number");
    }
  });

  it("accepts 0 for fields that allow it (bedrooms, lot_size, distance)", () => {
    const result = propertyFeaturesSchema.safeParse({
      ...VALID_INPUT,
      bedrooms: "0",
      lot_size: "0",
      distance_to_city_center: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bedrooms).toBe(0);
      expect(result.data.lot_size).toBe(0);
      expect(result.data.distance_to_city_center).toBe(0);
    }
  });
});
