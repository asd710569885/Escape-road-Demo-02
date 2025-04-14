<template>
    <div class="game" :class="{ 'theater-mode': isTheaterMode }">
        <!-- Top Bar: Rating and Controls -->
        <div class="top-bar">
             <Rating :game-id="props.gameId" v-show="!isTheaterMode" />
             <!-- 操作按钮区域 -->
             <div class="controls">
                  <button @click="toggleTheaterMode" class="control-button theater-button" :disabled="!iframeSrc || !isIframeLoaded">{{ theaterButtonText }}</button>
                  <button @click="toggleFullscreen" class="control-button fullscreen-button" :disabled="!iframeSrc || !isIframeLoaded">{{ fullscreenButtonText }}</button>
             </div>
        </div>

        <!-- 游戏区域 -->
        <div class="game-main" ref="gameContainerRef">
            <div v-if="!iframeSrc" class="iframe-overlay">
                <img :src="getImageUrl(gameData.image)" :alt="gameData.title" class="overlay-image" />
                <div class="blur-layer"></div>
                <button @click="loadGame" class="load-button">Start Game</button>
            </div>
            <iframe v-if="iframeSrc" class="iframehtml1" :src="iframeSrc" frameborder="0" allowfullscreen @load="onIframeLoad"></iframe>
        </div>

        <!-- Rating Component Removed From Here -->
        <!-- <Rating :game-id="props.gameId" v-show="!isTheaterMode" /> -->

        <h2 class="game-title" v-show="!isTheaterMode">{{ gameData.title }}</h2>
    </div>
</template>

<script setup>
import { ref, computed, onUnmounted, nextTick, onMounted } from 'vue' // 引入 nextTick 和 onMounted
import { games } from '../data/games'
import Rating from './Rating.vue'; // <-- Import Rating component

// 组件属性定义
const props = defineProps({
  gameId: {
    type: String,
    required: true,
    validator: (value) => {
      return Object.keys(games).includes(value)
    }
  }
})

// 获取当前游戏数据
const gameData = computed(() => {
  return games[props.gameId] || games.game1
})

// iframe源地址
const iframeSrc = ref(null)
// 剧院模式状态
const isTheaterMode = ref(false)
// 全屏状态 (通过监听事件更新)
const isFullscreen = ref(false)
// iframe 是否加载完成
const isIframeLoaded = ref(false)
// 游戏容器的模板引用
const gameContainerRef = ref(null)
// Theater按钮文字
const theaterButtonText = computed(() => isTheaterMode.value ? 'Exit the Theater' : 'Theater');
// Fullscreen按钮文字
const fullscreenButtonText = computed(() => isFullscreen.value ? 'Exit the Fullscreen' : 'Fullscreen');

// Helper function to get correct image URL for production builds
const getImageUrl = (imageName) => {
  if (!imageName) return ''
  // Relative path from GameMain.vue (in src/components) to src/assets/images
  try {
    return new URL(`../assets/images/${imageName}`, import.meta.url).href
  } catch (error) {
    console.error(`Error creating URL for image in GameMain.vue: ${imageName}`, error);
    return ''; // Return empty or a default placeholder
  }
}

/**
 * 加载游戏
 * 设置iframe源地址为当前游戏的URL
 */
const loadGame = () => {
  iframeSrc.value = gameData.value.iframeUrl
  isIframeLoaded.value = false; // Reset loading state when starting a new game
  console.log('Loading game, iframe source set, isIframeLoaded reset to false.');
}

/**
 * iframe 加载完成处理函数
 */
const onIframeLoad = () => {
  isIframeLoaded.value = true;
  console.log('iframe content loaded.');
}

/**
 * 切换剧院模式
 */
const toggleTheaterMode = async () => {
  if (!isIframeLoaded.value) return; // Prevent action if iframe not loaded
  const newValue = !isTheaterMode.value;
  isTheaterMode.value = newValue;
  await nextTick(); // Wait for DOM update (class binding)
  // 如果进入剧院模式时处于全屏，则退出全屏
  if (newValue && isFullscreen.value) {
    await exitFullscreen();
  }
}

/**
 * 切换全屏模式
 */
const toggleFullscreen = async () => {
  if (!isIframeLoaded.value) return; // Prevent action if iframe not loaded
  await nextTick(); // Wait for any pending Vue updates first
  if (!document.fullscreenElement) {
    await enterFullscreen();
  } else {
    await exitFullscreen();
  }
}

/**
 * 进入全屏
 */
const enterFullscreen = async () => {
    const element = gameContainerRef.value;
    if (!element) return;
    await nextTick(); // Wait for DOM to be ready before requesting fullscreen
    try {
        if (element.requestFullscreen) {
            await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) { /* Safari */
            await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) { /* IE11 */
            await element.msRequestFullscreen();
        }
        // 进入全屏后，如果处于剧院模式，则退出剧院模式
        if (isTheaterMode.value) {
           isTheaterMode.value = false;
        }
    } catch (err) {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    }
}

/**
 * 退出全屏
 */
const exitFullscreen = async () => {
    try {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            await document.msExitFullscreen();
        }
    } catch (err) {
        console.error(`Error attempting to disable full-screen mode: ${err.message} (${err.name})`);
    }
}


/**
 * 处理全屏状态变化事件
 */
const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement || !!document.webkitFullscreenElement; // 更新状态
    console.log("Fullscreen change event. Is fullscreen:", isFullscreen.value);
}


// 监听全屏变化事件
onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
})

// 组件卸载时清空 iframeSrc 并移除监听器
onUnmounted(() => {
  iframeSrc.value = null
  console.log(`GameMain for ${props.gameId} unmounted, iframeSrc reset.`);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
})
</script>

<style lang="css" scoped>
/* General Styles */
.game {
  width: 100%;
  padding: 20px; /* Increased padding for better spacing */
  background-color: #f0f2f5;
  display: flex;
  flex-direction: column;
  align-items: center; /* Center children horizontally */
  transition: all 0.3s ease; /* Transition all properties */
  position: relative;
  box-sizing: border-box;
  /* Removed min-height: 100vh */
}

/* Top Bar Container */
.top-bar {
  width: 100%;
  max-width: 1280px; /* Match game-main max-width */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px; /* Space below the bar */
  margin-bottom: 0; /* Optional: remove if padding-bottom is enough */
  box-sizing: border-box;
}

/* Adjust Rating styles for top bar if needed */
.top-bar > .rating-section { /* Target Rating component specifically inside top-bar */
  margin-top: 0; /* Remove top margin if it exists */
  padding: 0; /* Remove padding if needed, or adjust */
  background-color: transparent; /* Make background transparent */
  border-radius: 0;
  box-shadow: none;
  text-align: left; /* Align rating text left */
}
.top-bar > .rating-section h4 {
    margin-bottom: 5px; /* Reduce margin below title */
}
.top-bar > .rating-section .rating-display {
    flex-direction: row; /* Align stars and text horizontally */
    gap: 10px;
}

/* Controls Container - Adjustments */
.controls {
  /* width: 100%; */ /* No longer needs full width */
  /* max-width: 1280px; */ /* Handled by top-bar */
  display: flex; /* Already flex, ensure it remains */
  justify-content: flex-end; /* Already flex-end, ensure it remains */
  /* padding-bottom: 15px; */ /* Handled by top-bar */
}

/* Control Buttons General Style */
.control-button {
  padding: 8px 16px;
  margin-left: 10px;
  border: none;
  border-radius: 5px;
  background-color: #48b8c9;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500; /* Slightly bolder */
  transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.2s ease; /* Added box-shadow transition */
}

.control-button:hover {
  background-color: #3a9ca6;
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); /* Add subtle shadow on hover */
}

/* Game Main Area */
.game-main {
  position: relative;
  width: 100%;
  max-width: 1280px;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background-color: #000;
  transition: all 0.3s ease;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15); /* Enhanced shadow */
}

.iframehtml1 {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}

/* Game Title */
.game-title {
  color: #333;
  line-height: 1.5;
  text-transform: uppercase;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  margin-top: 20px; /* Increased margin */
  transition: opacity 0.3s ease, height 0.3s ease, margin 0.3s ease; /* Added height/margin transition */
}

/* iframe Overlay Styles (Loading Screen) */
.iframe-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
    border-radius: inherit;
}

.overlay-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
}

.blur-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6); /* Darker overlay */
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 2;
}

.load-button {
    position: relative;
    z-index: 3;
    padding: 15px 30px;
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    background: linear-gradient(135deg, #56cfe1, #72efdd);
    border: none;
    border-radius: 30px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.load-button:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 15px rgba(86, 207, 225, 0.5);
}

/* Theater Mode Styles */
.game.theater-mode {
  background-color: #111;
  padding: 0; /* Remove padding */
  position: fixed; /* Take over viewport */
  inset: 0; /* Replaces top, left, right, bottom: 0 */
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.game.theater-mode .game-main {
  width: 90vw;
  max-width: 1800px; /* Allow wider game in theater */
  height: auto;
  aspect-ratio: 16 / 9;
  border-radius: 0;
  box-shadow: none;
  max-height: 98vh; /* Slightly more height allowance */
}

.game.theater-mode .game-title {
  opacity: 0;
  height: 0;
  margin: 0;
  padding: 0; /* Ensure no padding */
  overflow: hidden;
}

.game.theater-mode .top-bar {
    display: none; /* Hide the whole top bar in theater mode */
}

/* Controls in Theater Mode (Overrides top-bar hiding) */
.game.theater-mode .controls {
  /* Existing theater mode styles for controls apply */
  display: flex; /* Ensure controls are visible in theater mode */
  position: absolute;
  top: 15px;
  right: 15px;
  width: auto;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 8px 12px;
  border-radius: 8px;
  z-index: 1001;
  max-width: none;
  padding-bottom: 8px;
}

/* Fullscreen Specific Styles */
/* Style the container WHEN it is fullscreen */
.game-main:fullscreen {
  max-width: none;    /* Remove max-width limit */
  max-height: none;   /* Remove max-height limit */
  border-radius: 0;   /* Remove border-radius */
  box-shadow: none;     /* Remove shadow */
  /* Width and height are automatically 100% in fullscreen */
}

/* Safari uses :-webkit-full-screen */
.game-main:-webkit-full-screen {
  max-width: none;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
}

/* Note: Hiding siblings like title/controls isn't strictly necessary
   when game-main itself is fullscreen, as they are outside the
   fullscreen element's rendering context. The browser handles this. */

</style>
