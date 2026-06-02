# 牙科知识 AI 问答 — 构建指南

## 环境要求

### Web 构建（最简）
- **Node.js** 22+ & npm 11+
- 运行：`npm run build` → 输出 `dist/index.html` 单文件

### 桌面 App 构建（Tauri v2）
- **Rust** 1.96+ (stable)
- **Windows**: Visual Studio Build Tools 2022（含 C++ 工作负载）或 MinGW-w64
- **macOS**: Xcode Command Line Tools
- **Linux**: `libwebkit2gtk-4.1-dev` 等依赖

### 移动端构建（Tauri v2 Mobile）
- **Android**: Android Studio + SDK + NDK + JDK 21+
- **iOS** (仅 macOS): Xcode 15+

---

## 中国网络环境配置

### npm 镜像
```bash
npm config set registry https://registry.npmmirror.com
```

### Rust 镜像（任选其一）

**中科大镜像：**
```toml
# ~/.cargo/config.toml
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
```

**字节跳动 rsproxy：**
```toml
[source.crates-io]
replace-with = 'rsproxy'

[source.rsproxy]
registry = "sparse+https://rsproxy.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
```

### Rust 安装镜像
```bash
# 使用 rsproxy.cn 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | bash

# 或使用环境变量
RUSTUP_DIST_SERVER="https://rsproxy.cn" RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" rustup-init.sh -y
```

**Windows MSVC 工具链（推荐）：**
```bash
# 如果使用的是 bash 安装的 GNU 工具链，切换到 MSVC
rustup default stable-x86_64-pc-windows-msvc
```

> 注意：如果安装时使用了 `rsproxy.cn/rustup-init.sh`，默认会检测为 `x86_64-pc-windows-gnu` 工具链。
> 如果系统有 Visual Studio Build Tools，建议切换到 `x86_64-pc-windows-msvc` 获得更好的兼容性。

### Android Gradle 镜像
```groovy
// %USERPROFILE%\.gradle\init.gradle
allprojects {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/public/' }
        maven { url 'https://maven.aliyun.com/repository/google/' }
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin/' }
        google()
        mavenCentral()
    }
}
```

---

## 构建命令

```bash
cd dentistry-mvp

# === Web 构建 ===
npm install
npm run build           # 输出 dist/index.html
npm run preview         # 预览构建产物

# === 桌面开发 ===
npm run tauri:dev       # 启动原生窗口（热重载）
npm run tauri:build     # 生产构建 → src-tauri/target/release/bundle/

# === Android ===
npm run tauri android init  # 首次初始化 Android 项目
npm run tauri android dev   # 连接设备调试
npm run tauri android build --apk   # 构建 APK
npm run tauri android build --aab   # 构建 AAB（商店用）

# === iOS (仅 macOS) ===
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build

# === 更新签名 ===
npm run tauri signer generate -- -w src-tauri/app.key
npm run tauri:build  # 使用私钥签名
```

---

## 目录结构

```
dentistry-mvp/
├── src/                    # React 源码
├── dist/                   # Web 构建产物
├── public/                 # 静态资源
├── src-tauri/              # Tauri 项目
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置
│   ├── capabilities/       # 权限清单
│   ├── icons/              # App 图标（由 tauri icon 生成）
│   ├── src/
│   │   ├── main.rs         # 桌面入口
│   │   └── lib.rs          # 核心逻辑 + 移动端入口
│   └── gen/                # 生成的移动端项目（gitignored）
├── scripts/                # 构建脚本
├── package.json
└── vite.config.ts
```

---

## 常见问题

### Windows: `error: could not compile 'getrandom' (lib)`
- 原因：`x86_64-pc-windows-gnu` 工具链缺少 `dlltool.exe`
- 解决：安装 MinGW-w64 的 binutils，或切换到 MSVC 工具链：
  ```bash
  rustup default stable-x86_64-pc-windows-msvc
  ```

### Windows: `error: linker 'link.exe' not found`
- 原因：缺少 MSVC 链接器
- 解决：安装 Visual Studio Build Tools 2022，选择"使用 C++ 的桌面开发"工作负载
- 或运行：`"C:\Program Files (x86)\Microsoft Visual Studio\...\vcvars64.bat"` 初始化环境

### macOS: `error: linking with cc failed`
- 原因：缺少 Xcode Command Line Tools
- 解决：`xcode-select --install`

### Android: Gradle 下载慢
- 原因：gradle.org 下载慢
- 解决：使用阿里云 Gradle 镜像（见上文配置）
