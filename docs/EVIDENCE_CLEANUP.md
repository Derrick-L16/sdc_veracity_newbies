# 附件文件离线清理（管理员）

入口：`artifacts/api-server/backend/evidence_cleanup.py`。这是有服务器／存储访问权限的
管理员手动工具，不是网页功能，不属于应用中的 Owner、Manager 或 Staff 权限。
它不会修改附件权限、上传协议、数据库记录或不可覆盖的对象约束，也不会定时运行。
需要 Python 3.10+、Node.js 24 和项目已安装的依赖；云端使用现有 App Storage 身份，
不要复制凭据或带签名 URL 到命令行、报告或文档。仅支持云存储；
`VERACITY_STORAGE=local` 时明确拒绝操作。

## 先确定哪些文件必须保留

- **备份数据库不是附件字节的备份。** 删除云端对象后，即使恢复旧 SQLite 数据库，
  旧附件也可能无法打开。保留期不能代替备份引用检查。
- 列出共享此私有附件目录的**所有活动数据库**（重复 `--db`），以及**所有仍可能恢复的
  SQLite 备份**（重复 `--backup`），包括演示清库前、测试前、人工导出和异地保存的备份。
  压缩／归档备份先解压成 SQLite 文件；不要直接传入 zip、SQL dump 或只复制 WAL 主文件。
  活数据库的备份应通过 SQLite backup API 制作，并将备份纳入本次检查。
- 如果无法取得某个仍需保留的备份，**只能预览，不能删除**。
  不要为了清理而删掉备份；先按业务要求明确哪些备份仍需支持恢复。
- `--backups-complete` 表示管理员确认上述清单完整；没有备份时也必须明确确认，
  不能仅凭工具在某个文件夹里没有找到备份就认定不存在。
  工具不能自动发现用户另存的历史备份，也不能验证这一人工声明。

以下路径只是占位示例，应替换成管理员已确认的文件；不默认读取某个数据库，
不默认检查整个磁盘或整个 bucket。

## 第一步：只预览

从项目根目录运行，报告写入已忽略的生成目录，避免把私有对象标识纳入 Git 或部署。

```sh
mkdir -p generated-artifacts/evidence-cleanup
python3 artifacts/api-server/backend/evidence_cleanup.py \
  --db /absolute/path/current.sqlite3 \
  --backup /absolute/path/before-cleanup.sqlite3 \
  --retention-days 90 \
  --backups-complete \
  --report generated-artifacts/evidence-cleanup/plan.json
```

备份范围尚未核实，可以省略 `--backups-complete` 查看初步候选，但该报告**不能执行删除**。
报告不会覆盖已有文件；重新预览应换一个文件名。

默认保留 **90 天**，最少 **30 天**。以对象创建时间和最近更新时间中较新的一个计龄，
缺少有效时间、大小或 generation 的对象不会成为候选。只列举当前私有目录下：

- `evidence-staging/<32位小写十六进制ID>`
- `case-evidence/<32位小写十六进制ID>`

不会枚举公共目录、别的前缀或 bucket 其他内容，不处理旧 generation／软删除历史版本。
它不会根据文件名包含 “test” 等字样判断是否可以删除。

JSON 报告的 `objects` 是候选清单（key、generation、大小、时间），`excluded` 展示保护原因。
报告不包含文件字节、原文件名、用户信息、签名 URL 或云凭据。
存储范围和数据库／备份文件清单用摘要绑定；更换目录、数据库或备份清单须重新预览。

保护规则：

| 条件 | 处理 |
|---|---|
| 当前 Case 附件，包括已关闭 Case、历史 assessment 的 attachmentIds | 永不由本工具删除 |
| 审计或库存账目里的历史文件引用 | 保留 |
| 活动数据库中的未完成上传凭据 | staging 和最终对象都保留，防止中途 finalize 或重试 |
| 已完成上传的当前附件 | 最终对象保留；不再需要的 staging 可在保留期后列为候选 |
| 任一备份引用或备份中的上传凭据 | 保守保留其所有引用，包含 staging |
| 无引用且超过保留期的合法附件对象 | 仅列为候选，预览不删除 |

**上传凭据没有可靠的过期时间，且可重试取得新的上传地址。** 因而“失败上传很旧”
不等于“上传已失效”。本工具不改写／删除凭据，也不凭对象年龄猜测凭据过期。
这类未完成上传会继续被保护；清库后确实没有任何活动数据库或备份引用的测试／失败
上传字节才可能成为候选。若需要回收仍有凭据的旧上传，需另行设计可撤销、可审计的
上传过期协议，不能绕过此保护。

数据库不存在、损坏、JSON 元数据无效、附件 key 无法解释、模式不兼容或读取失败，
均中止，不把“读不到引用”当成“没有引用”。工具支持缺少上传表的早期备份，
但活动数据库必须具有当前附件表结构。

## 第二步：停服务、再次预览、明确确认

删除是不可逆的；存储供应商的版本／软删除策略不作为本工具的恢复保证。
先逐项人工检查候选与备份清单，必要时另行归档需要保存的文件字节。

1. 停止共享该私有目录的所有服务：部署实例、预览 API/Python 后端、本地代理、
   测试进程、上传／finalize 请求和其他写入工具。只停止网页不够。
   **不要在其他实例仍可读写或可能恢复／替换数据库文件时确认离线。**
2. 等待在途请求完成，并等最后一张签名 PUT 地址失效（目前有效期 15 分钟；
   为保险至少等待 16 分钟）。锁只能阻止 SQLite 写入，无法阻止直传云端。
3. 使用与上面相同的完整 `--db`／`--backup` 清单，在停服状态重新生成一个新报告，
   例如 `offline-plan.json`，人工检查。报告仅在生成后 **24 小时内**有效。
4. 从该次预览输出复制完整的 `DELETE-EVIDENCE-<SHA256>` 确认字符串；不要编辑报告。
5. 再运行：

```sh
python3 artifacts/api-server/backend/evidence_cleanup.py \
  --db /absolute/path/current.sqlite3 \
  --backup /absolute/path/before-cleanup.sqlite3 \
  --retention-days 90 \
  --backups-complete \
  --apply generated-artifacts/evidence-cleanup/offline-plan.json \
  --offline-confirmation ALL-EVIDENCE-SERVICES-STOPPED \
  --confirm DELETE-EVIDENCE-替换为预览输出的完整摘要
```

工具执行前会重新检查全部当前与备份引用，核对保留期、清单与私有目录摘要，
并在整个删除阶段对所有活动 SQLite 持有写锁（不修改数据）。锁获取失败即中止。
报告中没有的对象不会被删除；新出现的引用、不同 generation／时间／大小均跳过。
每次删除都携带 generation-match 条件：预览后被覆盖的对象不会误删。
不会删除已关联附件，不会无条件清空 bucket，也不会解除对象保留策略。

同目录会独占创建 `offline-plan.json.deletions.jsonl`（权限 0600），记录开始、删除请求、
每项结果和完成。每次实际删除前先写入并同步审计记录；不能写审计就不开始删除。
不要把报告／日志存入版本库，它们仍含私有对象标识。

部分对象删除后如遇云端错误、generation 冲突、日志写入失败或进程中断，命令返回失败，
不会继续执行剩余删除。查看逐项日志；`delete-requested` 后没有 `deleted` 代表结果未确认，
不是保证文件还在。保留原日志，**重新 dry-run、重新确认**，不要覆盖日志或盲目重复旧命令。
最后再启动原服务；现有附件读取与上传权限保持不变。

## 验证

`pnpm test` 包含临时 SQLite 和内存存储替身测试，覆盖备份／活动上传保护、保留期、
历史引用、离线写锁、generation 变化、确认绑定和错误中止，不会操作真实云端文件。
