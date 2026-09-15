# Android 温湿度控制台开发计划

## 需求背景

基于现有的 Web 控制台（`index.html`），需要开发一个功能相同的 Android 应用。Web 控制台基于 Web Bluetooth API 实现了对 E104-BT5010A 温湿度采集设备的完整控制功能，包括：

1. **蓝牙设备连接管理** - 扫描和连接 PandaTemperature 设备
2. **实时温湿度数据** - 读取和订阅温度、湿度数据
3. **设备配置** - 读取/设置采集间隔、同步时间
4. **设备状态监控** - 读取设备状态（间隔、记录数、连接状态、时间同步状态）
5. **历史数据管理** - 获取和显示历史温湿度记录，并持久化存储到本地数据库
6. **操作日志** - 记录所有操作和事件

## 实现方案

### 技术架构

采用 **MVVM 架构模式**，使用 Kotlin + Jetpack Compose 进行开发：

```
app/
├── data/
│   ├── bluetooth/          # 蓝牙通信层
│   │   ├── BleManager.kt   # 蓝牙管理器（单例）
│   │   ├── BleService.kt   # GATT 服务封装
│   │   └── BleConstants.kt # UUID 常量定义
│   ├── database/           # 数据库层
│   │   ├── AppDatabase.kt  # Room 数据库
│   │   └── dao/            # DAO 接口
│   │       └── TemperatureRecordDao.kt
│   └── model/              # 数据模型
│       ├── TemperatureRecord.kt
│       └── DeviceStatus.kt
├── domain/                 # 业务逻辑层（可选，本次 MVP 暂不实现）
├── ui/
│   ├── viewmodel/          # ViewModel
│   │   └── MainViewModel.kt
│   ├── screen/             # Compose 界面
│   │   └── MainScreen.kt
│   └── components/         # 可复用组件
│       ├── ConnectionCard.kt
│       ├── RealtimeDataCard.kt
│       ├── ConfigCard.kt
│       ├── StatusCard.kt
│       ├── HistoryCard.kt
│       └── LogCard.kt
└── MainActivity.kt
```

### 核心功能模块

#### 1. 蓝牙通信层 (`data/bluetooth/`)

- **BleManager.kt**: 单例类，管理蓝牙连接生命周期

  - 扫描设备
  - 连接/断开连接
  - 发现服务和特征
  - 读写特征值
  - 订阅通知

- **BleConstants.kt**: 定义所有 UUID 常量
  ```kotlin
  object BleConstants {
      const val ESS_SERVICE = "0000181a-0000-1000-8000-00805f9b34fb"
      const val TEMP_CHAR = "00002a6e-0000-1000-8000-00805f9b34fb"
      // ... 其他 UUID
  }
  ```

#### 2. 数据模型 (`data/model/`)

- **TemperatureRecord.kt**: 温湿度记录数据类（Room Entity）
- **DeviceStatus.kt**: 设备状态数据类
- **LogEntry.kt**: 日志条目数据类

#### 3. 数据存储层 (`data/database/`)

- **AppDatabase.kt**: Room 数据库实例
- **TemperatureRecordDao.kt**: 历史数据访问接口
  - 插入记录
  - 查询所有记录
  - 按时间范围查询
  - 删除记录
  - 清空所有记录

#### 4. UI 层 (`ui/`)

- **MainViewModel.kt**: 管理应用状态和业务逻辑

  - 连接状态
  - 实时温湿度数据
  - 设备配置
  - 历史数据
  - 日志列表

- **MainScreen.kt**: 主界面，采用类似 Web 界面的卡片布局
  - 状态栏（连接状态、设备信息）
  - 连接控制卡片
  - 实时数据卡片
  - 配置卡片
  - 历史数据卡片
  - 日志卡片

### 依赖库

需要添加的依赖：

- `androidx.compose.material3` - 已存在
- `androidx.lifecycle:lifecycle-viewmodel-compose` - ViewModel 支持
- `androidx.lifecycle:lifecycle-runtime-compose` - 生命周期支持
- `androidx.room:room-runtime` - Room 数据库
- `androidx.room:room-ktx` - Room Kotlin 扩展
- `androidx.room:room-compiler` - Room 注解处理器（kapt）
- Android 系统蓝牙 API（无需额外依赖）

### 权限配置

在 `AndroidManifest.xml` 中添加：

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />
```

## 开发计划列表

### 阶段一：项目基础配置

- [x] 1.1 添加必要的依赖库到 `build.gradle.kts`
- [x] 1.2 配置 AndroidManifest.xml 蓝牙权限
- [x] 1.3 创建项目目录结构

### 阶段二：数据层开发

- [ ] 2.1 创建 `BleConstants.kt` 定义 UUID 常量
- [ ] 2.2 创建数据模型类（TemperatureRecord, DeviceStatus, LogEntry）
- [ ] 2.3 实现 `BleManager.kt` 核心蓝牙管理功能
  - [x] 扫描设备
  - [x] 连接设备
  - [x] 发现服务和特征
  - [x] 读写特征值
  - [x] 订阅通知
  - [x] 断开连接
- [x] 2.4 实现数据存储层
  - [x] 创建 `TemperatureRecordDao.kt` DAO 接口
  - [x] 创建 `AppDatabase.kt` Room 数据库
  - [x] 配置数据库迁移策略

### 阶段三：ViewModel 开发

- [x] 3.1 创建 `MainViewModel.kt`
- [x] 3.2 实现连接管理逻辑
- [x] 3.3 实现实时数据读取和订阅
- [x] 3.4 实现配置管理（间隔、时间同步）
- [x] 3.5 实现状态读取和订阅
- [x] 3.6 实现历史数据获取和解析
- [x] 3.7 实现历史数据存储（保存到本地数据库）
- [x] 3.8 实现历史数据加载（从本地数据库读取）
- [x] 3.9 实现日志管理

### 阶段四：UI 组件开发

- [x] 4.1 创建状态栏组件
- [x] 4.2 创建连接控制卡片组件
- [x] 4.3 创建实时数据卡片组件
- [x] 4.4 创建配置卡片组件
- [x] 4.5 创建状态卡片组件
- [x] 4.6 创建历史数据卡片组件
- [x] 4.7 创建日志卡片组件

### 阶段五：主界面集成

- [x] 5.1 创建 `MainScreen.kt` 主界面
- [x] 5.2 集成所有卡片组件
- [x] 5.3 更新 `MainActivity.kt` 使用新界面
- [x] 5.4 处理权限请求

### 阶段六：测试与优化

- [ ] 6.1 测试蓝牙连接功能
- [ ] 6.2 测试数据读取和订阅
- [ ] 6.3 测试历史数据获取
- [ ] 6.4 测试历史数据存储和加载
- [ ] 6.5 UI/UX 优化
- [ ] 6.6 错误处理优化

## 注意事项

1. **Android 蓝牙权限**: Android 12+ 需要动态申请 `BLUETOOTH_SCAN` 和 `BLUETOOTH_CONNECT` 权限
2. **数据解析**: 注意字节序（小端序），与 Web 端保持一致
3. **生命周期管理**: 确保在应用退出时正确断开蓝牙连接
4. **UI 风格**: 参考 Web 界面的紫色渐变主题风格
5. **最小化实现**: 按照 MVP 原则，先实现核心功能，后续可扩展
6. **数据持久化**: 使用 Room 数据库存储历史温湿度记录，应用重启后数据不丢失
7. **数据同步**: 从设备获取历史数据后自动保存到本地数据库，支持增量更新
