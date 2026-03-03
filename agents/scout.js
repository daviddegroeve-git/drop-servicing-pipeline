const axios = require('axios');

/**
 * Scout Agent
 * Queries Google Places API to find local businesses that have a phone number but no website.
 */
class ScoutAgent {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!this.apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not defined in environment variables.');
    }
  }

  /**
   * Search for businesses matching a query
   * @param {string} query - The search query (e.g., "restaurant in Riyadh")
   * @returns {Promise<Array>} List of businesses meeting criteria
   */
  async findLeads(query) {
    console.log(`[Scout] Searching for leads with query: "${query}"...`);

    try {
      // Step 1: Text Search to get a list of places
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
      const searchResponse = await axios.get(searchUrl);

      if (searchResponse.data.status !== 'OK' && searchResponse.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API Error: ${searchResponse.data.status} - ${searchResponse.data.error_message || ''}`);
      }

      const places = searchResponse.data.results || [];
      console.log(`[Scout] Found ${places.length} initial places. Filtering...`);

      const validLeads = [];

      // Step 2: Get details for each place to check phone number and website
      for (const place of places) {
        // Request detailed fields including reviews, business types, and photos to enhance AI generation
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,website,reviews,types,photos&key=${this.apiKey}`;
        const detailsResponse = await axios.get(detailsUrl);

        if (detailsResponse.data.status === 'OK') {
          const details = detailsResponse.data.result;

          // Filter logic: Only return results where formatted_phone_number exists AND website is undefined or null.
          if (details.formatted_phone_number && !details.website) {
            console.log(`[Scout] Found match: ${details.name} (Phone: ${details.formatted_phone_number})`);

            // Extract top 3 positive reviews to feed to the AI
            const topReviews = details.reviews
              ? details.reviews.filter(r => r.rating >= 4).slice(0, 3).map(r => r.text)
              : [];

            // Extract up to 5 photos from Google Maps to use instead of placeholder images
            const photos = details.photos
              ? details.photos.slice(0, 5).map(p => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${this.apiKey}`)
              : [];

            validLeads.push({
              placeId: place.place_id,
              name: details.name,
              phone: details.formatted_phone_number,
              address: place.formatted_address,
              location: place.geometry?.location,
              types: details.types || [],
              reviews: topReviews,
              photos: photos
            });
          }
        }
      }

      console.log(`[Scout] Finished scouting. Found ${validLeads.length} valid leads without websites.`);
      return validLeads;
    } catch (error) {
      console.error(`[Scout] Error during lead generation: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ScoutAgent;
