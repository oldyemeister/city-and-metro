# 浏览器测试文件

本目录放测试存档和对应的复现说明。原始玩家导出保留在上级目录；当前上海存档是原文件的逐字节副本，不要用测试进度覆盖它。

- 默认存档：`城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json`。
- 预览：`http://localhost:8001/`，优先 Chrome for Testing 独立测试标签页及测试 profile；不可用时允许普通 Chrome 的隔离测试 profile。始终显示窗口，不使用 headless。
- 本机 Chrome for Testing 位于 `/Users/jacky/Applications/Google Chrome for Testing.app`，不是系统 `/Applications`；可执行路径记录在 Skill 配置中。
- 自动验收准备与执行共限时 120 秒；未完成则保留现场，交给用户手动检查。
- 当前存档的地图、年月及相关线路必须在载入后核实，文件名不能替代内容核对；它不保证包含其他年份或后来建成的线路。

默认配置在 `.agents/skills/metro-browser-check/test-settings.json`。可在任务中临时指定其他存档，例如：

> 使用 $metro-browser-check，存档选 savedgames/test/指定文件.cmsave.json，检查地理和示意图里的目标共线区段。

新场景说明应注明存档文件、地图/年月、复现操作、预期结果。只有实际检查过的场景才记录为通过。

玩家导出的 `.cmsave.json` 文件仅保留本地，由 `.gitignore` 排除，不随 GitHub 分支上传。新检出环境需要手动放入指定测试导出，才能执行依赖该存档的检查；不要把缺少夹具报成测试通过。
