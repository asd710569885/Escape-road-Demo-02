<template>
  <div class="comments-section">
    <h3>发表评论</h3>
    <form @submit.prevent="submitComment" class="comment-form">
      <div class="form-group">
        <label for="name">昵称:</label>
        <input type="text" id="name" v-model="newComment.name" required />
      </div>
      <div class="form-group">
        <label for="email">邮箱:</label>
        <input type="email" id="email" v-model="newComment.email" required />
      </div>
      <div class="form-group">
        <label for="content">评论内容:</label>
        <textarea id="content" v-model="newComment.content" rows="4" required></textarea>
      </div>
      <button type="submit" :disabled="isSubmitting">{{ isSubmitting ? '提交中...' : '提交评论' }}</button>
      <p v-if="submitError" class="error-message">{{ submitError }}</p>
      <p v-if="submitSuccess" class="success-message">评论提交成功！</p>
    </form>

    <div class="comments-list">
      <h3>评论列表</h3>
      <p v-if="isLoading">加载评论中...</p>
      <p v-else-if="fetchError" class="error-message">{{ fetchError }}</p>
      <p v-else-if="comments.length === 0">还没有评论，快来抢沙发吧！</p>
      <ul v-else>
        <li v-for="comment in comments" :key="comment.id" class="comment-item">
          <p><strong>{{ comment.name }}</strong> <span class="timestamp">({{ formatTimestamp(comment.timestamp) }})</span></p>
          <p>{{ comment.content }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';

// 从父组件接收 gameId
const props = defineProps({
  gameId: {
    type: String,
    required: true,
  },
});

const comments = ref([]); // 存储评论列表
const newComment = reactive({ // 存储新评论表单数据
  name: '',
  email: '',
  content: '',
});

const isLoading = ref(false); // 是否正在加载评论
const fetchError = ref(null); // 加载评论时的错误信息
const isSubmitting = ref(false); // 是否正在提交评论
const submitError = ref(null); // 提交评论时的错误信息
const submitSuccess = ref(false); // 评论是否提交成功

const API_BASE_URL = 'http://localhost:3000/api/comments'; // 后端 API 地址

// 获取评论
const fetchComments = async (gameId) => {
  if (!gameId) return;
  isLoading.value = true;
  fetchError.value = null;
  comments.value = []; // 清空旧评论
  try {
    const response = await fetch(`${API_BASE_URL}/${gameId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    comments.value = await response.json();
  } catch (error) {
    console.error('Error fetching comments:', error);
    fetchError.value = '加载评论失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
};

// 提交评论
const submitComment = async () => {
  if (!props.gameId) return;
  // 简单前端验证
  if (!newComment.name || !newComment.email || !newComment.content) {
    submitError.value = '请填写所有必填项。';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newComment.email)) {
     submitError.value = '请输入有效的邮箱地址。';
     return;
   }

  isSubmitting.value = true;
  submitError.value = null;
  submitSuccess.value = false;

  try {
    const response = await fetch(`${API_BASE_URL}/${props.gameId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newComment.name,
        email: newComment.email,
        content: newComment.content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to get error message from server
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const addedComment = await response.json();
    comments.value.unshift(addedComment); // 将新评论添加到列表顶部

    // 清空表单并显示成功信息
    newComment.name = '';
    newComment.email = '';
    newComment.content = '';
    submitSuccess.value = true;
    setTimeout(() => submitSuccess.value = false, 3000); // 3秒后隐藏成功信息

  } catch (error) {
    console.error('Error submitting comment:', error);
    submitError.value = `提交失败: ${error.message || '请稍后重试。'}`;
  } finally {
    isSubmitting.value = false;
  }
};

// 格式化时间戳
const formatTimestamp = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // 可以根据需要调整格式
    return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '日期无效';
  }
};

// 组件挂载时获取初始评论
onMounted(() => {
  fetchComments(props.gameId);
});

// 监听 gameId 变化，重新获取评论
watch(() => props.gameId, (newGameId) => {
  fetchComments(newGameId);
});
</script>

<style scoped>
.comments-section {
  margin-top: 40px;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.comment-form .form-group {
  margin-bottom: 15px;
}

.comment-form label {
  display: block;
  margin-bottom: 5px;
  color: #555;
  font-weight: bold;
}

.comment-form input[type="text"],
.comment-form input[type="email"],
.comment-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box; /* Important for width calculation */
}

.comment-form textarea {
  resize: vertical; /* Allow vertical resizing */
}

.comment-form button {
  padding: 10px 20px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.comment-form button:disabled {
  background-color: #a9cce3;
  cursor: not-allowed;
}

.comment-form button:hover:not(:disabled) {
  background-color: #2980b9;
}

.error-message {
  color: #e74c3c;
  margin-top: 10px;
  font-size: 0.9em;
}

.success-message {
  color: #2ecc71;
  margin-top: 10px;
  font-size: 0.9em;
}

.comments-list {
  margin-top: 30px;
}

.comments-list ul {
  list-style: none;
  padding: 0;
}

.comment-item {
  border-bottom: 1px solid #eee;
  padding: 15px 0;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-item p {
  margin: 5px 0;
  color: #333;
}

.comment-item .timestamp {
  font-size: 0.85em;
  color: #777;
  margin-left: 10px;
}
</style> 