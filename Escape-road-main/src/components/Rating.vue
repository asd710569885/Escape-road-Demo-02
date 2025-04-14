<template>
  <div class="rating-section">
    <h4>游戏评分</h4>
    <div v-if="isLoading" class="loading">正在加载评分...</div>
    <div v-else-if="fetchError" class="error-message">{{ fetchError }}</div>
    <div v-else class="rating-display">
      <div class="stars">
        <span
          v-for="star in 5"
          :key="star"
          class="star"
          :class="{ filled: star <= displayAverage, interactive: !hasRated }"
          @click="rateGame(star)"
          @mouseover="hoverRating = hasRated ? 0 : star"
          @mouseleave="hoverRating = 0"
          :title="hasRated ? '您已评分' : `${star} 星`"
        >
          {{ (hoverRating >= star || (hoverRating === 0 && displayAverage >= star)) ? '★' : '☆' }}
        </span>
      </div>
      <div class="rating-info">
        <span v-if="ratingCount > 0">平均 {{ displayAverage }}/5 ({{ ratingCount }} 人评分)</span>
        <span v-else>暂无评分</span>
      </div>
      <p v-if="submitError" class="error-message">{{ submitError }}</p>
      <p v-if="submitMessage" class="success-message">{{ submitMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps({
  gameId: {
    type: String,
    required: true,
  },
});

const averageRating = ref(0);
const ratingCount = ref(0);
const isLoading = ref(false);
const fetchError = ref(null);
const submitError = ref(null);
const submitMessage = ref(null);
const isSubmitting = ref(false);
const hoverRating = ref(0); // Rating on hover
const hasRated = ref(false); // Track if user has rated in this session

const API_BASE_URL = '/api/ratings'; // Use relative path for deployment

const ratingData = ref(null);

// Calculate display average (rounded to nearest 0.5 for star display maybe? or keep 1 decimal)
const displayAverage = computed(() => parseFloat(averageRating.value)); // Keep one decimal

// Fetch current rating
const fetchRating = async (gameId) => {
  if (!gameId) return;
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await fetch(`${API_BASE_URL}/${gameId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    averageRating.value = data.average;
    ratingCount.value = data.count;
  } catch (error) {
    console.error('Error fetching rating:', error);
    fetchError.value = '加载评分失败。';
  } finally {
    isLoading.value = false;
  }
};

// Submit a new rating
const rateGame = async (score) => {
  if (!props.gameId || isSubmitting.value || hasRated.value) return;

  isSubmitting.value = true;
  submitError.value = null;
  submitMessage.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/${props.gameId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ score }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    averageRating.value = data.average; // Update rating display
    ratingCount.value = data.count;
    hasRated.value = true; // Mark as rated for this session
    submitMessage.value = '感谢您的评分！';
    setTimeout(() => submitMessage.value = null, 3000);

  } catch (error) {
    console.error('Error submitting rating:', error);
    submitError.value = `评分失败: ${error.message || '请稍后重试。'}`;
  } finally {
    isSubmitting.value = false;
  }
};

// Fetch initial rating on mount
onMounted(() => {
  fetchRating(props.gameId);
});

// Watch for gameId changes
watch(() => props.gameId, (newGameId) => {
  hasRated.value = false; // Reset rated status when game changes
  submitMessage.value = null; // Clear messages
  submitError.value = null;
  fetchRating(newGameId);
});
</script>

<style scoped>
.rating-section {
  margin-top: 20px;
  padding: 15px;
  background-color: #f0f0f0; /* Slightly different background */
  border-radius: 8px;
  text-align: center;
}

.rating-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #444;
}

.rating-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.stars {
  font-size: 1.8em; /* Larger stars */
  color: #ccc; /* Default empty star color */
  cursor: default;
}

.star {
  transition: color 0.2s ease-in-out;
}

.star.interactive {
    cursor: pointer;
}

.star.filled {
  color: #f39c12; /* Filled star color (gold) */
}

.rating-info {
  font-size: 0.9em;
  color: #555;
}

.loading,
.error-message {
  color: #e74c3c;
  font-size: 0.9em;
}

.success-message {
  color: #2ecc71;
  font-size: 0.9em;
  margin-top: 5px;
}
</style> 