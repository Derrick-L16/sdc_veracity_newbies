# 手动导入与演示

系统不会自动加载这些商品。使用 Manager 登录，在 Inbox → Import records 导入。

## 导入顺序

1. 选择 Inventory products，导入 `artifacts/veracity/public/examples/products.csv`。
2. 选择 Unposted stock movements，导入 `artifacts/veracity/public/examples/movements.csv`。
3. 暂时不要导入 `additional-evidence.csv`；它用于稍后补充饼干的损坏记录。

CSV 是样例，不是真实营业数据。`name` 决定页面上的商品名称；可以在首次导入前修改。
`product_id` 必须与商品的 `id` 对应。不要重复导入相同 ID；导入只新增，不覆盖库存。

## 三组操作

| 商品 | 初始账面 | Staff 输入实盘 | 初始结果 | 后续操作 |
|---|---:|---:|---|---|
| Mineral Water 500ml | 50 | 43 | 销售合计 −7，支持差异 | Manager 查看后 Approve，库存变成 43 |
| Chocolate Biscuits | 40 | 33 | 只有销售 −3，证据不足 | Request review；导入额外记录并 Reassess；再 Approve，库存变成 33 |
| Canned Coffee | 24 | 22 | 送货／退货有冲突 | Request review 保留调查，或经人工确认后 Override 至 22；也可以 Reject 并重盘 |

额外记录：Import type 选择 Unposted stock movements，导入 `additional-evidence.csv`，
再进入饼干 Case 点击 Refresh evidence & reassess。导入本身不会刷新 assessment 或修改库存。

出入库样例使用固定的过去时间，确保发生在新盘点之前。它们是解释差异的旧记录，
不代表本周实际销售；本周盘点和决定按真实操作时间统计。

如想先体验无差异盘点，可以先为咖啡输入 24，不会创建 Case；之后再输入 22 体验差异调查。

## 文件附件与记录证据不同

- CSV movements：结构化记录，参与系统的数量匹配检查。
- Case documents：上传 JPG、PNG、PDF，供人审阅，不会自动匹配差异或批准 Case。
- Staff 可为自己提交的开放 Case 上传，Manager 可上传，Owner 只能查看。

最后换成 Owner，查看 Summary、Decision overview 和只读 Decision Passport。

## 防止测试数据再次混入

`tests/migration.spec.ts` 和 `tests/evidence.spec.ts` 会在所连接的后端写入测试业务记录。
不要在保存演示或真实数据的数据库上运行这些测试；应使用独立的测试实例／数据库。
测试前应先备份。普通刷新或登录不会产生 Migration test 商品。

数据库清理不等于附件文件清理：旧 SQLite 备份仍可能引用 App Storage 中的附件，
不能直接清空 bucket 或仅按文件年龄删除。管理员需要回收失败上传或测试残留时，
使用[附件文件离线清理指南](EVIDENCE_CLEANUP.md)；先 dry-run，核对活动上传和所有保留备份，
停服后明确确认才能删除。没有可靠过期时间的上传凭据继续受保护。
