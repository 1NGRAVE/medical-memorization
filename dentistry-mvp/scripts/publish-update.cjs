/**
 * Tauri 更新发布脚本
 *
 * 在 `npm run tauri:build` 后运行此脚本，自动：
 * 1. 收集 .sig 签名文件
 * 2. 生成 updater.json 清单
 * 3. 提示上传到 OSS 的命令
 *
 * 用法: node scripts/publish-update.cjs [version]
 * 示例: node scripts/publish-update.cjs 1.0.1
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const BUNDLE_DIR = path.resolve(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle')
const VERSION = process.argv[2] || require(path.resolve(__dirname, '..', 'package.json')).version
const NOTES = process.env.UPDATE_NOTES || '更新说明请补充...'

// OSS 配置（部署前修改为实际值）
const OSS_BASE = 'https://medical-memorization.oss-cn-hangzhou.aliyuncs.com'
const DOWNLOADS_PATH = '/downloads'
const UPDATES_PATH = '/updates'

console.log(`📦 发布版本 v${VERSION}`)
console.log('')

// 查找签名文件
function findSigFiles(dir) {
  const sigs = {}
  function walk(d) {
    if (!fs.existsSync(d)) return
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.sig')) {
        sigs[entry.name] = full
      }
    }
  }
  walk(dir)
  return sigs
}

function main() {
  if (!fs.existsSync(BUNDLE_DIR)) {
    console.error('❌ 未找到构建产物目录:', BUNDLE_DIR)
    console.error('   请先运行: npm run tauri:build')
    process.exit(1)
  }

  // 查找所有 .sig 文件
  const sigs = findSigFiles(BUNDLE_DIR)

  if (Object.keys(sigs).length === 0) {
    console.error('❌ 未找到 .sig 签名文件')
    console.error('   构建时需设置 TAURI_PRIVATE_KEY 环境变量进行签名')
    console.error('   首先生成密钥: npm run tauri signer generate -- -w src-tauri/app.key')
    process.exit(1)
  }

  console.log('✅ 找到签名文件:')
  for (const [name, filepath] of Object.entries(sigs)) {
    console.log(`   ${name} (${(fs.statSync(filepath).size / 1024).toFixed(1)} KB)`)
  }
  console.log('')

  // 构建 updater.json
  const platforms = {}

  for (const [name, filepath] of Object.entries(sigs)) {
    const sigContent = fs.readFileSync(filepath, 'utf-8').trim()

    // 根据签名文件名推断平台和安装包 URL
    let platform, urlPath

    if (name.includes('msi')) {
      platform = 'windows-x86_64'
      urlPath = `${DOWNLOADS_PATH}/DentistryMVP_${VERSION}_x64_zh-CN.msi`
    } else if (name.includes('app') && name.includes('x64')) {
      platform = 'darwin-x86_64'
      urlPath = `${DOWNLOADS_PATH}/DentistryMVP_${VERSION}_x64.dmg`
    } else if (name.includes('app') && name.includes('aarch64')) {
      platform = 'darwin-aarch64'
      urlPath = `${DOWNLOADS_PATH}/DentistryMVP_${VERSION}_aarch64.dmg`
    } else {
      console.warn(`⚠ 跳过未知签名文件: ${name}`)
      continue
    }

    platforms[platform] = {
      signature: sigContent,
      url: `${OSS_BASE}${urlPath}`,
    }
  }

  const updater = {
    version: `v${VERSION}`,
    notes: NOTES,
    pub_date: new Date().toISOString(),
    platforms,
  }

  const updaterPath = path.resolve(__dirname, '..', 'dist-oss', 'updater.json')
  fs.mkdirSync(path.dirname(updaterPath), { recursive: true })
  fs.writeFileSync(updaterPath, JSON.stringify(updater, null, 2), 'utf-8')

  console.log('📋 生成的 updater.json:')
  console.log(JSON.stringify(updater, null, 2))
  console.log('')
  console.log('---')
  console.log('')
  console.log('📤 上传到阿里云 OSS 的命令:')
  console.log('')
  console.log(`# 1. 上传更新清单`)
  console.log(`ossutil cp dist-oss/updater.json oss://medical-memorization${UPDATES_PATH}/updater.json`)
  console.log('')
  console.log('# 2. 上传安装包（从 bundle 目录）')
  if (platforms['windows-x86_64']) {
    const msiSource = Object.entries(sigs).find(([n]) => n.includes('msi'))
    if (msiSource) {
      const msiFile = msiSource[0].replace('.sig', '')
      console.log(`ossutil cp src-tauri/target/release/bundle/msi/${msiFile} oss://medical-memorization${DOWNLOADS_PATH}/DentistryMVP_${VERSION}_x64_zh-CN.msi`)
    }
  }
  if (platforms['darwin-x86_64']) {
    console.log(`ossutil cp src-tauri/target/release/bundle/dmg/DentistryMVP_${VERSION}_x64.dmg oss://medical-memorization${DOWNLOADS_PATH}/DentistryMVP_${VERSION}_x64.dmg`)
  }
  if (platforms['darwin-aarch64']) {
    console.log(`ossutil cp src-tauri/target/release/bundle/dmg/DentistryMVP_${VERSION}_aarch64.dmg oss://medical-memorization${DOWNLOADS_PATH}/DentistryMVP_${VERSION}_aarch64.dmg`)
  }
  console.log('')
  console.log('# 3. 上传下载引导页（首次发布）')
  console.log(`ossutil cp public/landing.html oss://medical-memorization/index.html`)
  console.log(`ossutil cp dist/index.html oss://medical-memorization/web/index.html`)
  console.log('')
  console.log('✅ 发布脚本执行完成')
}

main()
