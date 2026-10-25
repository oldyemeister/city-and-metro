# oldyemeister 的个人修改记录

本分支基于 [VinsonFung/city-and-metro](https://github.com/VinsonFung/city-and-metro)，用于个人兴趣探索、学习和大学业余项目。这里记录个人扩展，不代表原作者的官方更新。

保留原项目的 `LICENSE.txt`、版权与第三方署名；继续遵守非商业使用条款及适用的第三方许可。

## 2026-10-25 · 四城现实线路色与自定义调色

基于上一版个人扩展（`5e978fc`），新增杭州、香港、广州、台北的具名线路色，并为所有地图提供自定义颜色编辑。

| 地图 | 选项数 | 收录范围 |
| --- | ---: | --- |
| 杭州 | 13 | 杭州地铁现有 12 条线（区分杭港地铁运营的 1、5 号线），以及杭海城际 |
| 广州 | 21 | 1–14、18、21、22 号线、广佛线、APM，以及佛山 2、3 号线 |
| 香港 | 11 | 港铁 9 条市区/通勤线、机场快线，以及轻铁系统代表色；不逐条列出轻铁运营路线 |
| 台北 | 12 | 台北捷运五条主线、两条支线，新北环状线/淡海轻轨/安坑轻轨/三鶯線，以及桃园机场捷运 |
| 东京 | 77 | 保留上一版已收录的线路 |

以上合计 134 个具名选项，按当前地图展示。颜色为参考值，不要求对应游戏中的历史年份。各真实地图隐藏重复的原版色板；旧线路的实际 HEX、默认配色数组和存档格式保持不变。虚构教程保留原版色板并支持自定义色。

### 自定义颜色

- 接受六位十六进制输入，支持 `12ABEF` 或 `#12ABEF`，不区分大小写。
- 提供浏览器原生颜色选择器；HEX、取色器和滑块双向同步。
- 使用 HSV 色彩模型，分别调节色相（0–359°）、饱和度（0–100%）和亮度（0–100%）。
- 输入过程中仅更新预览；点击“应用到草案”或在有效 HEX 输入框按 Enter 后，才产生一次草案编辑。仍需原有“确认建设”步骤。
- 无效或不完整的色码显示就地提示并禁止应用；同色应用也不产生多余撤销记录。
- 页面因统计更新而重绘时保留尚未应用的颜色输入；切换线路或正式/草案颜色改变时按对应线路重置。
- 保留悬停/键盘提示中的运营商、现实线路名、HEX；补充简繁体搜索兼容。

### 验证与使用

运行 `node scripts/check-line-colors.mjs` 检查各城路由、线路去重、参考色、简繁体搜索、非法 HEX、4096 组 RGB/HSV 往返和教程回退。可附加一个存档路径，验证该存档的改色、撤销、重做、确认与导出再导入。

用已有东京存档检查了 162 站、14 线的兼容性，以及自定义色、纯黑、纯白的存档往返。构建命令仍为 `node scripts/build.mjs`。

浏览器验证了四城色板切换、非法输入提示、取色器与滑块同步、未应用预览的重绘保留，以及一次应用对应一次草案编辑；检查了窄屏与明暗主题。在实际游戏中打开原有东京存档并预览自定义色，控制台无错误。

入口：线路详情 → 线路名称与颜色 → 自定义颜色；下方为当前城市的现实线路色。旧页面先保存进度再刷新，即可加载新增功能。

### 数据来源（2026-10-25 核对）

- [杭州地铁配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/Hangzhou_Metro)、[运营线路](https://en.wikipedia.org/wiki/Hangzhou_Metro)。
- [广州地铁配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/Guangzhou_Metro)、[运营线路](https://en.wikipedia.org/wiki/Guangzhou_Metro)、[佛山配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/Foshan_Metro)。
- [港铁配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/MTR)、[港铁官方线路图](https://www.mtr.com.hk/en/customer/services/system_map.html)。
- [台北捷运配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/Taipei_Metro)、[新北捷运配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/New_Taipei_Metro)、[桃园捷运配色](https://en.wikipedia.org/wiki/Module:Adjacent_stations/Taoyuan_Metro)。
- [新北市捷运工程局：三鶯線](https://www.dorts.ntpc.gov.tw/about/route/1MJjdJr7dAv6)，确认 2026-06-30 已通车；没有将其列为未来线路，也未混入其他规划线路。

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
