<script setup>
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier New', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #060a16;
  min-height: 100vh;
  color: #e0ffe0;
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: rgba(57, 255, 20, 0.02);
}

::-webkit-scrollbar-thumb {
  background: rgba(57, 255, 20, 0.15);
  border-radius: 0;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(57, 255, 20, 0.3);
}
</style>
