/**
 * 安装脚本：将打包好的 VSIX 解压到 VS Code 扩展目录
 * 使用方式：npm run deploy（会自动先打包再安装）
 * 安装后在 VS Code 中执行 Reload Window 即可生效
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = require('../package.json');
const extName = `${pkg.publisher}.${pkg.name}-${pkg.version}`;
const vsixFile = path.join(__dirname, '..', `${pkg.name}-${pkg.version}.vsix`);

// VS Code 扩展安装目录
const extDir = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.vscode', 'extensions', extName
);

if (!fs.existsSync(vsixFile)) {
    console.error(`❌ 找不到 VSIX 文件: ${vsixFile}`);
    console.error('   请先运行 npm run build');
    process.exit(1);
}

// 清理旧安装
if (fs.existsSync(extDir)) {
    fs.rmSync(extDir, { recursive: true, force: true });
    console.log(`🗑️  已清理旧版本: ${extDir}`);
}

// 解压 VSIX（VSIX 就是 ZIP 格式）
const tempDir = path.join(require('os').tmpdir(), 'larksync_install');
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}

// VSIX 是 ZIP 格式，但 PowerShell 只认 .zip 后缀
const tempZip = path.join(require('os').tmpdir(), 'larksync_install.zip');
fs.copyFileSync(vsixFile, tempZip);

if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempDir}' -Force"`, { stdio: 'inherit' });
} else {
    fs.mkdirSync(tempDir, { recursive: true });
    execSync(`unzip -o "${tempZip}" -d "${tempDir}"`, { stdio: 'inherit' });
}

fs.rmSync(tempZip, { force: true });

// 将 extension/ 子目录复制到扩展安装位置
const srcDir = path.join(tempDir, 'extension');
fs.cpSync(srcDir, extDir, { recursive: true });

// 清理临时文件
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(`✅ 安装完成: ${extDir}`);
console.log('👉 请在 VS Code 中执行 Reload Window (Ctrl+Shift+P → Reload Window)');
