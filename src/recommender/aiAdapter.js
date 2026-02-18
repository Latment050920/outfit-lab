import { ruleBasedRecommend } from './ruleBased.js';

/**
 * @param {Object} request RecommendationRequest
 * @param {Array} wardrobe item[]
 * @returns {Promise<Object>} RecommendationResponse
 */
export async function getAIRecommendation(request, wardrobe) {
  // TODO: replace with real API call in future, keeping response shape stable.
  return ruleBasedRecommend(request, wardrobe);
}
