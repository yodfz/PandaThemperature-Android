# 设置页面设备配置Modal改造 - 开发计划

## 需求背景

当前设置页面的设备配置卡片（ConfigCard）直接在卡片内显示输入框和"设置间隔"按钮，用户可以直接在设置页面进行编辑操作。为了改善用户体验，需要将设备配置改为弹出 Modal 的方式来处理：
1. 设置页面默认以只读模式显示所有配置状态（类似 StatusCard）
2. 点击"编辑"按钮后，弹出配置 Modal 进行编辑
3. Modal 中的按钮文字改为"保存"

## 实现方案

### 1. 修改 ConfigCard.kt
- 改为只读显示模式，移除输入框和"设置间隔"按钮
- 添加"当前采集间隔"的只读展示（参考 StatusCard 的样式）
- 添加"编辑"按钮，仅在设备连接时可用
- 保持与 StatusCard 一致的视觉风格

### 2. 创建 ConfigModal.kt
- 新建配置编辑 Modal 组件（参考 DeviceSelectionDialog.kt）
- 使用 AlertDialog 实现 Modal
- 包含采集间隔输入框（10-3600 秒范围）
- 包含"保存"按钮（替代原来的"设置间隔"）
- 包含"取消"按钮
- 输入验证：确保输入值在有效范围内

### 3. 修改 SettingsScreen.kt
- 添加 Modal 显示状态管理：`var showConfigModal by remember { mutableStateOf(false) }`
- 将 Modal 状态传递给 ConfigCard 的编辑按钮
- 处理保存逻辑：调用 `viewModel.setInterval()`
- 保存后关闭 Modal

## 开发计划

- [x] 创建开发计划文档
- [x] 修改 ConfigCard.kt - 改为只读显示模式，添加编辑按钮
- [x] 创建 ConfigModal.kt - 新建配置编辑 Modal 组件
- [x] 修改 SettingsScreen.kt - 添加 Modal 状态管理
- [x] 代码审查和测试验证

## 架构设计考虑

1. **职责分离**：ConfigCard 负责展示，ConfigModal 负责编辑，符合单一职责原则
2. **状态管理**：Modal 状态由 SettingsScreen 管理，避免状态管理混乱
3. **代码复用**：Modal 组件独立，可以在其他地方复用
4. **用户体验**：只读模式让用户先查看状态，编辑时才弹出 Modal，体验更清晰

## 注意事项

1. Modal 的样式要与现有 Dialog 保持一致
2. 输入验证要完善，防止无效数据
3. 保存成功后要关闭 Modal
4. 编辑按钮要在设备未连接时禁用
