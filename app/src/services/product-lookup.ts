// Product Lookup Service (Unified)

export interface ProductResult {
    brand: string;
    productName: string;
    image?: string;
    ingredientsText?: string;
    source: 'OpenFoodFacts' | 'UPCitemdb' | 'Unknown';
}

// 1. OpenFoodFacts (Best Data)
const lookupOFF = async (barcode: string): Promise<ProductResult | null> => {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        if (!response.ok) return null;
        const data = await response.json();

        if (data.status === 1 && data.product) {
            return {
                brand: data.product.brands || "Unknown Brand",
                productName: data.product.product_name || "Unknown Product",
                image: data.product.image_url,
                ingredientsText: data.product.ingredients_text,
                source: 'OpenFoodFacts'
            };
        }
    } catch (e) {
        console.warn("OFF Lookup failed", e);
    }
    return null;
};

// 2. UPCitemdb (Fallback)
const lookupUPC = async (barcode: string): Promise<ProductResult | null> => {
    try {
        // "trial" endpoint: rate limited but free.
        const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            return {
                brand: item.brand || "Unknown Brand",
                productName: item.title || "Unknown Product",
                image: item.images?.[0],
                ingredientsText: undefined, // They rarely have this
                source: 'UPCitemdb'
            };
        }
    } catch (e) {
        console.warn("UPC Lookup failed", e);
    }
    return null;
};

export const lookupProduct = async (barcode: string): Promise<ProductResult | null> => {
    // Parallel fetch for speed? Or sequential to save rate limits?
    // Sequential is safer for "Priority" logic.

    // 1. Try OFF
    const offResult = await lookupOFF(barcode);
    if (offResult) return offResult;

    // 2. Try UPC
    const upcResult = await lookupUPC(barcode);
    if (upcResult) return upcResult;

    return null;
};
