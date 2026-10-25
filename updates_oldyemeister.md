# oldyemeister 的个人修改记录

本分支基于 [VinsonFung/city-and-metro](https://github.com/VinsonFung/city-and-metro)，用于个人兴趣探索、学习和大学业余项目。这里记录个人扩展，不代表原作者的官方更新。

保留原项目的 `LICENSE.txt`、版权与第三方署名；继续遵守非商业使用条款及适用的第三方许可。

## 2026-10-25 · 东京及周边铁路线路色库

基线：v2.0.0，提交 `4102340f8e9dc142024a43b7ddc1dfac60986098`。

### 新增功能

- 新增 16 个运营商分组，共 77 个具名线路色选项：东京メトロ全部 9 线、都营地下铁全部 4 线，以及 JR、东急、京王、小田急、西武、东武、京成、京急和其他东京周边铁路。
- 鼠标悬停或键盘 Tab 聚焦色块时，显示运营商、现实线路名及完整 HEX 色值，例如 `東京メトロ · 銀座線 · #FF9500`。
- 支持用中日文线路名、英文别名、运营商、线路代号或 HEX 搜索。
- 色块上显示线路代号，文字按背景明度选择黑白；提供选中标记、键盘聚焦样式及窄屏换行。
- 配色参考链接随所查看的运营商更新到相应 Wikipedia 来源。

### 重复选项修正

原版东京的 13 个色块与新色库的东京メトロ、都营地下铁对应同一组线路，但 HEX 并不完全一致。例如原版丸ノ内線为 `#E60012`，本次收录的 Wikipedia 参考色为 `#F62E36`。

东京色板只展示具名的新色库，去掉重复的原版 13 格。旧存档已有色值保持原样，并可在“当前颜色”中看到原版配色说明；只有主动选色并确认建设才会改变线路颜色。

不同真实线路使用相同 HEX 时仍保留各自名称，便于搜索与辨认。因此 77 指线路选项数量，不是 77 个互不相同的色值。其他地图仍保留各自原版色板。

### 存档与游戏行为

- 颜色元数据只服务于界面，线路存档仍保存原来的 `line.color` 十六进制字符串。
- 未改动存档版本、地图网格、默认线路色数组、交通模拟或经济规则。
- 选色复用原有草案流程，支持撤销、重做、放弃草案和确认建设。
- 现行代表色不受游戏年代限制，也不自动把旧线路换成新参考色。

### 修改文件

| 文件 | 内容 |
| --- | --- |
| `js/line_colors.js` | 线路色元数据、来源、搜索别名、当前色说明与文字对比度 |
| `js/pages.js` | 线路详情中的分组色板、搜索和提示 |
| `css/style.css` | 色板布局、状态与窄屏样式 |
| `index.html` | 加载颜色模块 |
| `updates_oldyemeister.md` | 个人修改记录 |

### 验证

- JavaScript 语法检查和 `git diff --check` 通过。
- `node scripts/build.mjs` 构建通过，静态资源引用完整。
- 用一个 1957 年 7 月的东京存档检查：162 座车站、14 条线路均可恢复，所有原始线路色保持不变。
- 实际执行改色草案、撤销、重做、确认建设、导出再导入，确认颜色往返正确；原始存档文件未改写。
- 浏览器验证导入、中文/HEX 搜索、键盘提示、选色与放弃草案；窄屏色板没有横向溢出。

### 使用方法

在仓库目录运行 `python3 -m http.server 8001 --bind 127.0.0.1`，打开 [localhost:8001](http://localhost:8001/)。已有服务器时无需重复启动。

进入线路详情 → 线路名称与颜色 → 搜索或选择色块 → 确认建设。刷新代码前先确认草案并保存进度；已有浏览器存档也可继续使用。

导入文件：开始游戏 → 东京 → 读取存档 → 导入 `.cmsave.json`。浏览器存档与下载的存档文件不同；Chrome、其他浏览器以及 `localhost`/`127.0.0.1` 各自使用独立的站点存储。

### 配色来源与范围

查阅日期：2026-10-25。整理的是 Wikipedia 展示的线路名称、代号和颜色数值，不复制或执行其 Lua 程序。这些颜色用作游戏内参考，不保证等同于运营商所有历史版本或每种媒介的官方色彩规范。覆盖东京地铁及大量东京/周边铁路，未宣称覆盖全部首都圈铁路。

各运营商的具体来源链接记录在 `js/line_colors.js` 的 `source` 字段，并列于下方。

- [東京メトロ](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tokyo%20Metro)：9 条
- [都営地下鉄](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Toei%20Subway)：4 条
- [JR東日本](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/JR%20East)：21 条
- [東急電鉄](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tokyu)：7 条
- [京王電鉄](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Keio)：7 条
- [小田急電鉄](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Odakyu)：2 条
- [西武鉄道](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Seibu%20Railway)：10 条
- [東武鉄道](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tobu)：4 条
- [京成電鉄](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Keisei%20Electric%20Railway)：4 条
- [京急電鉄](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Keikyu)：2 条
- [東京都交通局](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Toei)：2 条
- [東京モノレール](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tokyo%20Monorail)：1 条
- [ゆりかもめ](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Yurikamome)：1 条
- [首都圏新都市鉄道](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tsukuba%20Express)：1 条
- [埼玉高速鉄道](https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Saitama)：1 条
- [東京臨海高速鉄道](https://en.wikipedia.org/wiki/Rinkai_Line)：1 条
