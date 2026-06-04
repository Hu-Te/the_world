import { ref } from 'vue'
import { useRouter } from 'vue-router'
import JSZip from 'jszip'
import type { HomeToolId } from '@/three/home/homeToolIds'
import { HOME_TOOL_LABELS } from '@/three/home/homeToolIds'
import {
  buildFilePreview,
  FilePreviewError,
  revokeFilePreview,
  type FilePreviewState,
} from '@/utils/filePreview'

export function useHomeTools() {
  const router = useRouter()
  const toast = ref('')
  let toastTimer = 0

  const zipCompressRef = ref<HTMLInputElement>()
  const zipExtractRef = ref<HTMLInputElement>()
  const filePreviewRef = ref<HTMLInputElement>()
  const previewOpen = ref(false)
  const previewState = ref<FilePreviewState | null>(null)

  function showToast(msg: string) {
    toast.value = msg
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast.value = ''
    }, 2800)
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function closePreview() {
    revokeFilePreview(previewState.value)
    previewState.value = null
    previewOpen.value = false
  }

  async function onZipCompress(e: Event) {
    const input = e.target as HTMLInputElement
    const files = input.files
    if (!files?.length) return

    showToast('正在压缩…')
    try {
      const zip = new JSZip()
      for (const file of files) zip.file(file.name, file)
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `打包-${Date.now()}.zip`)
      showToast(`已打包 ${files.length} 个文件`)
    } catch {
      showToast('压缩失败')
    } finally {
      input.value = ''
    }
  }

  async function onZipExtract(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    showToast('正在解压…')
    try {
      const zip = await JSZip.loadAsync(file)
      let count = 0
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const blob = await entry.async('blob')
        const name = path.split('/').pop() ?? path
        downloadBlob(blob, name)
        count++
      }
      showToast(count > 0 ? `已解压 ${count} 个文件` : 'ZIP 内没有文件')
    } catch {
      showToast('解压失败')
    } finally {
      input.value = ''
    }
  }

  async function onFilePreview(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    closePreview()
    const isCad = /\.(dwg|dxf)$/i.test(file.name)
    showToast(isCad ? '正在上传图纸至云端切片服务，大文件可能需要较长时间…' : '正在加载预览…')
    try {
      previewState.value = await buildFilePreview(file)
      previewOpen.value = true
      toast.value = ''
      window.clearTimeout(toastTimer)
    } catch (e) {
      showToast(e instanceof FilePreviewError ? e.message : '无法预览该文件')
    } finally {
      input.value = ''
    }
  }

  function openFilePreviewPicker() {
    filePreviewRef.value?.click()
  }

  async function copyText(text: string, tip: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(tip)
    } catch {
      showToast('复制失败')
    }
  }

  function activateTool(id: HomeToolId) {
    switch (id) {
      case 'zip-compress':
        zipCompressRef.value?.click()
        break
      case 'zip-extract':
        zipExtractRef.value?.click()
        break
      case 'file-preview':
        openFilePreviewPicker()
        break
      case 'timestamp': {
        const sec = Math.floor(Date.now() / 1000)
        const readable = new Date(sec * 1000).toLocaleString('zh-CN')
        void copyText(String(sec), `${readable}`)
        break
      }
      case 'uuid':
        void copyText(crypto.randomUUID(), 'UUID 已复制')
        break
      case 'color': {
        const hex = `#${Math.floor(Math.random() * 0xffffff)
          .toString(16)
          .padStart(6, '0')}`
        void copyText(hex, `颜色 ${hex} 已复制`)
        break
      }
      case 'copy-link':
        void copyText(window.location.href, '链接已复制')
        break
      case 'goto-game':
        void router.push('/game')
        break
      case 'goto-world':
        void router.push('/world')
        break
      case 'goto-draw':
        void router.push('/draw')
        break
      default:
        showToast(HOME_TOOL_LABELS[id])
    }
  }

  return {
    toast,
    zipCompressRef,
    zipExtractRef,
    filePreviewRef,
    previewOpen,
    previewState,
    onZipCompress,
    onZipExtract,
    onFilePreview,
    closePreview,
    openFilePreviewPicker,
    activateTool,
    showToast,
  }
}
