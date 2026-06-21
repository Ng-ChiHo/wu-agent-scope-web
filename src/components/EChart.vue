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

function tryInit() {
  if (chartInstance.value || !chartRef.value) return
  const { clientWidth, clientHeight } = chartRef.value
  if (clientWidth === 0 || clientHeight === 0) return false
  chartInstance.value = echarts.init(chartRef.value)
  if (props.option && Object.keys(props.option).length > 0) {
    chartInstance.value.setOption(props.option)
  }
  window.addEventListener('resize', handleResize)
  return true
}

onMounted(() => {
  if (!tryInit()) {
    observer = new ResizeObserver(() => {
      if (tryInit()) {
        observer?.disconnect()
        observer = null
      }
    })
    observer.observe(chartRef.value)
  }
})

watch(() => props.option, (newOption) => {
  if (!tryInit()) return
  if (newOption && Object.keys(newOption).length > 0) {
    chartInstance.value.setOption(newOption, true)
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
