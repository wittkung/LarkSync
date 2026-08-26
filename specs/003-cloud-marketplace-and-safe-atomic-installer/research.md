# Research Findings: 插件商店分发协议与安全安装架构

## 1. 工业界分发架构对比决策

- **决策 (Decision)**：采用 **GitHub Releases 资产存储 + 静态 JSON 索引 (`marketplace.json`) + 客户端内置 Ed25519 签名公钥** 的架构。
- **理由 (Rationale)**：
  - 0 维护高并发基础设施成本，完全依托 GitHub 全球 CDN 分发；
  - 配合客户端 ETag 与 SWR（Stale-While-Revalidate）缓存，实现无感秒开；
  - 密码学数字签名阻断 CDN 投毒、DNS 劫持与篡改。
- **替代方案 (Alternatives Considered)**：
  - 中心化数据库与 API 网关（如 Open-VSX / VS Code）：运维成本高、单点故障风险大；
  - 纯 Git 克隆模式（如早期 Homebrew）：对大体积二进制插件包不友好，磁盘开销大。

---

## 2. 密码学门禁与签名链

- **算法**：RFC 8032 Ed25519 (Curve25519 Edwards 签名算法)。
- **公私钥规格**：32 字节 Raw Seed / Public Key，Base64 编码。
- **性能与安全性**：Apple CryptoKit 原生硬件加速，验签仅需几微秒，内存开销可忽略。

---

## 3. 两阶段提交 (2PC) 与 APFS replaceItem

- **机制**：
  1. 解压至临时 Staging 沙盒；
  2. 校验文件完整性、Manifest 与权限声明；
  3. 通过 `FileManager.replaceItem` 进行原子目录置换；
  4. 动态加载失败自动回滚旧版本备份。
- **收益**：彻底杜绝进程在写入中途被杀导致的插件损坏状态。
