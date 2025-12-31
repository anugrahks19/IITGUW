export interface OFFProduct {
    code: string;
    product_name: string;
    brands: string;
    image_url: string;
    ingredients_text: string;
    nutriments: {
        "energy-kcal_100g": number;
        "sugars_100g": number;
        "fat_100g": number;
        "proteins_100g": number;
        "salt_100g": number;
        [key: string]: any;
    };
    nutriscore_grade: string;
    nova_group: number;
    additives_tags: string[];
    allergens_tags: string[];
}

const OFF_API_BASE = "https://world.openfoodfacts.org/api/v2/product";

export const fetchProductByBarcode = async (barcode: string): Promise<OFFProduct | null> => {
    try {
        console.log(`🔍 OFF: Fetching ${barcode}...`);
        const response = await fetch(`${OFF_API_BASE}/${barcode}.json`);

        if (!response.ok) {
            console.warn(`OFF: API Error ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.status === 1 && data.product) {
            console.log(`✅ OFF: Found ${data.product.product_name}`);
            return data.product as OFFProduct;
        } else {
            console.warn("OFF: Product not found");
            return null;
        }
    } catch (e) {
        console.error("OFF Network Error:", e);
        return null;
    }
};

export const formatProductSummary = (p: OFFProduct): string => {
    return `
    Product: ${p.product_name} (${p.brands})
    Nutri-Score: ${p.nutriscore_grade?.toUpperCase() || '?'} | NOVA: ${p.nova_group || '?'}
    Calories: ${p.nutriments["energy-kcal_100g"]}kcal/100g
    Sugar: ${p.nutriments["sugars_100g"]}g | Salt: ${p.nutriments["salt_100g"]}g
    Ingredients: ${p.ingredients_text || "Unknown"}
    Additives: ${p.additives_tags?.join(", ") || "None"}
    `.trim();
};
