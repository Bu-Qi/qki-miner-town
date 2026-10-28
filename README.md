# QKI 矿工小镇

基于 QKI 的资源经营网页游戏，包含免费试玩矿区和通过智能合约记录进度的链上矿区。

## 功能

- 三类资源矿场：铜矿、能量、晶石；有限矿机分配与矿场升级。
- 五种制造配方、订单交付、成长徽章、矿队扩建和生产加速。
- MetaMask、TokenPocket 等 EVM 钱包连接，QKI 网络添加与切换，真实余额读取。
- 自动读取节点 Gas 报价，也支持自定义 gwei 单价；提交前展示费用估算。
- 链上操作经钱包确认，成功回执后重新读取合约数据；试玩存档单独保留。
- 响应式中文界面、原创 SVG 矿区地图、音效与减少动态效果设置。

## 本地运行

需要 Node.js 和 npm。本项目已在 Node.js 24 环境验证。

```bash
npm ci
npm run compile:contracts
npm test
python3 -m http.server 8080 --directory dist
```

打开 http://localhost:8080。浏览器运行资源已包含在 dist 中，不依赖外部 CDN。页面的资源路径以站点根目录为基准，部署时请将 dist 作为站点根目录。

## 使用 QKI 链上矿区

1. 打开「链上」页面，连接 EVM 钱包。
2. 切换或添加 QKI 主网，Chain ID 为 20181205。
3. 连接已部署的同版本游戏合约，或通过钱包部署一份新合约。
4. 读取已有矿区，或确认交易创建该钱包的链上矿区。
5. 采集、合成、升级、订单等写入操作由钱包签名并支付 QKI 网络 Gas。

当前未内置已部署的主网合约地址。合约不接收充值、不管理奖池、不发放可提现的 QKI，也没有管理员、代理升级或代币授权入口。材料、设备和积分是合约中的游戏数值，当前不提供 NFT 转出或兑换功能。

试玩进度保存在当前浏览器；链上进度按钱包地址记录，两者不会互相导入。链上记录不能通过试玩重置按钮清除。

## 目录

| 路径 | 用途 |
| --- | --- |
| dist/index.html | 游戏入口 |
| dist/app.mjs | 游戏界面与模式切换 |
| dist/engine.mjs | 试玩规则与生产计算 |
| dist/art.mjs | SVG 地图与图标 |
| dist/chain.mjs | 钱包、RPC、交易准备及回执读取 |
| dist/chain-ui.mjs | 钱包与合约接入界面 |
| dist/contracts/QKIMinerTown.sol | 游戏智能合约 |
| dist/contracts/QKIMinerTown.json | ABI、部署字节码与运行时代码哈希 |
| scripts/compile-contracts.mjs | 合约编译与 ethers 资源准备 |
| tests/chain.test.mjs | 本地 EVM 回归测试 |

## 合约与测试

合约使用 Solidity 0.8.38 编译，目标为 Petersburg EVM，并检查运行时代码大小。页面连接现有合约时会核对运行时代码哈希。

本地 Ganache 测试覆盖生产计时与前端规则一致性、资源扣除、重复订单拒绝、玩家数据隔离、矿机数量限制、钱包账户变更、网络切换、交易哈希恢复和拒绝直接充值。页面完整流程也已在隔离的本地 EVM 中验证。主网部署仍需使用者通过钱包执行。

## 第三方代码

ethers 6.17.0 的浏览器版本及 MIT 许可证保留在 dist/vendor 中。构建依赖的精确版本由 package-lock.json 固定。
