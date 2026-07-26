/**
 * 仅在 /admin 路由注册 Element Plus，避免首页/工具舱首屏拉一整套表格组件。
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  let registered = false

  async function registerAdminUi() {
    if (registered) return
    registered = true

    const [
      { ElAlert, ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElLoading, ElOption, ElPagination, ElSelect, ElTable, ElTableColumn, ElTag },
    ] = await Promise.all([
      import('element-plus'),
      import('element-plus/es/components/alert/style/css'),
      import('element-plus/es/components/button/style/css'),
      import('element-plus/es/components/dialog/style/css'),
      import('element-plus/es/components/form/style/css'),
      import('element-plus/es/components/form-item/style/css'),
      import('element-plus/es/components/input/style/css'),
      import('element-plus/es/components/loading/style/css'),
      import('element-plus/es/components/option/style/css'),
      import('element-plus/es/components/pagination/style/css'),
      import('element-plus/es/components/select/style/css'),
      import('element-plus/es/components/table/style/css'),
      import('element-plus/es/components/table-column/style/css'),
      import('element-plus/es/components/tag/style/css'),
      import('element-plus/es/components/message/style/css'),
    ])

    const app = nuxtApp.vueApp
    app.component('ElButton', ElButton)
    app.component('ElTable', ElTable)
    app.component('ElTableColumn', ElTableColumn)
    app.component('ElPagination', ElPagination)
    app.component('ElDialog', ElDialog)
    app.component('ElForm', ElForm)
    app.component('ElFormItem', ElFormItem)
    app.component('ElInput', ElInput)
    app.component('ElSelect', ElSelect)
    app.component('ElOption', ElOption)
    app.component('ElTag', ElTag)
    app.component('ElAlert', ElAlert)
    app.directive('loading', ElLoading.directive)
  }

  const path = window.location.pathname
  if (path.startsWith('/admin')) {
    void registerAdminUi()
  }

  const router = useRouter()
  router.beforeEach((to) => {
    if (to.path.startsWith('/admin')) {
      return registerAdminUi().then(() => undefined)
    }
  })
})
