# Quickstart & Verification: 002 TTZip Plugin & LarkSync Deepening

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Created**: 2026-08-26
- **Status**: Ready for Verification

---

## 1. Test Execution Commands

```bash
# 1. 运行 Rust 核心递归遍历与 DocX 转换测试
cargo test

# 2. 重新编译 UniFFI 跨语言绑定
./scripts/generate-bindings.sh

# 3. 校验 TTZip 宿主与插件 Swift 包依赖
swift package --package-path /Users/kevintung/Documents/dev/products/ttzip/apple dump-package > /dev/null
```
