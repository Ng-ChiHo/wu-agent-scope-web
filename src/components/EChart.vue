<template>
  <div ref="chartRef" class="echart-container" :style="{ height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '400px' }
})

const chartRef = ref(null)
const chartInstance = shallowRef(null)
let observer = null

function ensureInit() {
  if (chartInstance.value) return true
  if (!chartRef.value) return false
  const { clientWidth, clientHeight } = chartRef.value
  if (clientWidth === 0 || clientHeight === 0) return false
  chartInstance.value = echarts.init(chartRef.value)
  window.addEventListener('resize', handleResize)
  return true
}

function applyOption(option) {
  if (!option || !option.series || option.series.length === 0) return
  if (chartInstance.value) {
    chartInstance.value.setOption(option, true)
  }
}

onMounted(() => {
  if (!ensureInit()) {
    observer = new ResizeObserver(() => {
      if (ensureInit()) {
        observer?.disconnect()
        observer = null
        applyOption(props.option)
      }
    })
    observer.observe(chartRef.value)
  } else {
    applyOption(props.option)
  }
})

watch(() => props.option, (newOption) => {
  if (ensureInit()) {
    applyOption(newOption)
  }
}, { deep: true })

function handleResize() {
  chartInstance.value?.resize()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  observer?.disconnect()
  chartInstance.value?.dispose()
})
</script>

<style scoped>
.echart-container {
  width: 100%;
  min-height: 300px;
  border-radius: 8px;
}
</style>
