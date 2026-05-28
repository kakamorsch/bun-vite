<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
</script>

<template>
  <div class="container">
    <h1>🚀 Bun-Vite Hybrid</h1>
    <p>Se você está vendo isso, o adapter Bun ↔ Vite está funcionando!</p>
    <button @click="count++">Cliques: {{ count }}</button>
  </div>
</template>

<style scoped>
.container {
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 2rem;
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
}
</style>
