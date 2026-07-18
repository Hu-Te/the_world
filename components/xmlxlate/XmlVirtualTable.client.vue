<template>
  <ElAutoResizer class="xx-vtable">
    <template #default="{ height, width }">
      <ElTableV2
        :columns="columns"
        :data="data"
        :width="width"
        :height="height"
        :row-height="46"
        :header-height="42"
        fixed
        class="xx-el-table" />
    </template>
  </ElAutoResizer>
</template>

<script setup lang="ts">
import { ElAutoResizer, ElTableV2 } from 'element-plus'
import type { Column } from 'element-plus'
import 'element-plus/es/components/table-v2/style/css'
import type { XmlRow } from '~/utils/xmlxlate/api'

defineProps<{
  columns: Column<XmlRow>[]
  data: XmlRow[]
}>()
</script>

<style scoped lang="scss">
.xx-vtable {
  width: 100%;
  height: 100%;
}

.xx-el-table {
  --el-bg-color: transparent;
  --el-fill-color-blank: transparent;
  --el-text-color-primary: #e2e8f0;
  --el-text-color-regular: #cbd5e1;
  --el-text-color-secondary: #94a3b8;
  --el-border-color: rgba(148, 163, 184, 0.12);
  --el-border-color-lighter: rgba(148, 163, 184, 0.1);
  --el-table-border: 1px solid rgba(148, 163, 184, 0.1);
  --el-table-header-bg-color: rgba(8, 47, 73, 0.92);
  --el-table-header-text-color: #a5f3fc;
  --el-table-row-hover-bg-color: rgba(34, 211, 238, 0.08);
  --el-table-tr-bg-color: transparent;
  --el-disabled-bg-color: transparent;
  color: #e2e8f0;
  background: transparent !important;
}

:deep(.el-table-v2) {
  background: transparent !important;
  --el-table-border-color: rgba(148, 163, 184, 0.1);
}

:deep(.el-table-v2__header-cell) {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  background: rgba(8, 47, 73, 0.95) !important;
  color: #a5f3fc !important;
  border-bottom: 1px solid rgba(34, 211, 238, 0.2) !important;
}

:deep(.el-table-v2__row) {
  border-bottom: 1px solid rgba(148, 163, 184, 0.08) !important;
}

:deep(.el-table-v2__row-cell) {
  font-size: 0.82rem;
  color: #e2e8f0 !important;
}

:deep(.el-table-v2__empty) {
  background: transparent !important;
  color: rgba(186, 230, 253, 0.45) !important;
}
</style>
