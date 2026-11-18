# 上海道路分配的语言与硬件对照

2026-11-17，`performance` 分支，HEAD `f9706d4`。本次复核先前的 Worker、内存和路由优化对话，在隔离测试环境比较现有实现。正式游戏继续使用原分派规则。

## 玩家实际等待

同一台 M2 Pro、同一份 2000 年 7 月上海 121 站导出、同一可见 Chrome for Testing 156、4 道路 / 2 方式选择 / 2 地铁 Worker。每个场景都从同一份导出重新恢复。测试只在生成的道路 Worker 中放行游戏已附带的 Rust/WASM，保留模块不可用或失败时的 JS 回退。正式分派在 请求终点对数 /（块内起点数 × 全部小区数）达到 75% 时选择 WASM。较早的记录和本次结果均显示，上海样本的稀疏块走 JS。

| 实际操作 | 正式分派（本例全部 JS） | 使用现有 WASM | 时间减少 |
| --- | ---: | ---: | ---: |
| 游戏按钮快进 3 个月，JS 先跑 | 10.016 s | 7.511 s | 25.0% |
| 游戏按钮快进 3 个月，WASM 先跑 | 9.617 s | 7.371 s | 23.4% |
| 月末最后一分钟起以 1 倍速越过月界，从过月计到交通就绪 | 7.788 s | 5.887 s | 24.4% |

两次季度快进平均省 2.376 秒，自然跨月省 1.902 秒。每次季度测试实际使用指定内核计算全部 1,280 块，跨月为 1,024 块。三对场景前后均逐项比较 232 个时段数组的类型、长度与字节哈希，另比较 20 个指标、时段统计、25 个经营字段、账本及网络哈希和时钟。全部通过，运行及资源错误计数为零。测试用时 102.349 秒；隔离窗口保留在上海 2000-08-01 00:00，已暂停，交通就绪。单机、单存档、2 对季度与 1 对月界的样本无法确定其他地图的最优分派阈值。[配对汇总](../wasm-dispatch-browser-GF8uPU/comparison.json) · [原始记录](../wasm-dispatch-browser-GF8uPU/results.json)

## 受控离线对照

两组使用同一份实际月度首次道路分配，1,329 个起点、7,392 个节点、20,634 条有向弧、375,919 个请求的起终点对。每次测试均与原版完整时间、里程、32 块独立流量及有序合并流量的 SHA-256 对照。两组各自预热两次，交替运行。

| 对照范围 | 原版 JS 中位数 | 候选中位数 | 时间减少 |
| --- | ---: | ---: | ---: |
| 一个 V8 实例内执行生产 Worker 处理函数，32 块串行，6 对 | 763.33 ms | 游戏内置稠密 Rust/WASM 579.50 ms | 24.1% |
| 相同稀疏分配含原顺序合并，8 对 | 749.87 ms | 编译为 ARM64 机器码的独立 C++ 实现 430.98 ms | 42.5% |

第一组包括 JS 稀疏转稠密、WASM 线性内存拷贝、稠密结果取回与筛选，计时不含线程通信、主线程归并、哈希及冷安装。第二组采用本机 Apple Clang 21、`-O3 -mcpu=native -ffp-contract=off -fno-fast-math`，通过一次 Node-API 调用访问同一组类型数组，使用原堆的相等处理、遍历、Float32 舍入和分块顺序；输入准备、工作区分配、哈希在计时之外。这是独立的测试移植，固定输入及工作区，每轮使用新的 stamp。两组的实现、边界与数据搬运不同，579.50 和 430.98 的差不能归因于 Wasm 沙箱。原生程序需要桌面宿主集成才能计量玩家时间，不能从网页直接调用此插件。[WASM 对照](../wasm-dispatch-browser-GF8uPU/offline-handler.json) · [原生对照](native-sparse.json)

## 工作量与可选算法

- 第一份分配中，原版扫描 2,534 万条弧，完成 886 万次节点定型、962 万次出堆、1.17 亿次堆键比较。所有 1,329 个起点均耗尽堆，平均定型全图 90.2% 的节点。OD 表的稀疏度决定输出量，目的地散布及入口可达性决定搜索量。之前两个 Chrome 记录中 `carTree` 占道路 Worker 活跃样本约 94%；其中一份标记区间的函数内样本约 45.6% 对应出堆，45.9% 对应扫边、松弛与入堆。采样定位不能直接给出缓存未命中或分支预测失败的比例。[堆计数](../HEAP-PARAMETERS.md) · [采样方法](../OPTIMIZATION-DIRECTIONS.md)
- 在原版节点定型顺序上作事后计算：提前知道所有不可达接入口，并在最后一个可达目标入口定型时停，只能减少 6.91% 的节点定型；假设进一步免费知道每个终点最终选中的入口，停在最后一个赢家入口也只减少 8.30% 的定型或 7.41% 的扫边。这只是两种按原顺序截短搜索的理想工作量。过去只缓存终点列表、保守早停、少读堆子节点，分别测得无收益、无收益、游戏时间正负混合。图索引与新的搜索顺序不受这一估算约束。[入口与前驱计数](oracle.json) · [历史缓存实验](../KERNEL-FINDINGS.md) · [早停](../EARLY-STOP.md) · [堆读取](../CHILD-READ.md)
- 同一份导出推进一个月，离线同步求解的 16 次请求共用同一图代次，16 份 Float32 弧时间的完整哈希互不相同。工作日和周末的八个时段各比较两轮，有 10.3% 至 41.3% 的弧权发生变化。一次请求内的 32 块确实共享权重，跨轮沿用最短路树需要另行验证新权重下的最优性和同长路径选择。[权重记录](weights.json)
- 更大图若仍慢，可以在 Worker 内用稀疏 ABI，直接传入每个起点的终点偏移和需求，写回稀疏结果。这测试的是减少稠密数组分配、遍历及拷贝能节省多少；要拿它对比已加速的现有 WASM。另一个局部选项是按现有邻接顺序存连续的终点、弧时间和里程，前驱仍存原弧 ID；要计入每次更新权重的重排成本。现阶段二者均为待测设想。[当前适配层](../../../src-sim/road-worker.js) · [当前内循环](../../../js/sim.js)
- 更长期的算法路线是可定制收缩层次（CCH）：道路拓扑变化时预处理，拥堵权重变化时重新定权，批量处理 OD 后把流量还原到原弧。论文研究了最短路查询和交通分配两部分。此游戏还需要再现原版的多入口、同长路径前驱、沿边逐步舍入里程以及原始分块求和。这一份输入就有 142,985 次松弛遇到另一个同权前驱，其中 1,428 次若接受，会在该步写出不同的 Float32 里程。用新算法只验证最短时间将漏掉路段流量和经营差异。评估应包含预处理及每轮定权的摊销，避免直接套用论文中大型公路网的速度。[原始交通分配论文](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.SEA.2018.27)
- 硬件为 M2 Pro 12 核、16 GiB。4 个道路 Worker 先前已带来端到端收益，2010 年 278 站存档三轮季度中位数从 2 个的 16.873 秒降到 4 个的 9.642 秒；一年从 71.997 秒降到 40.229 秒。标记区间四个道路 Worker 的处理时间以线程 CPU 计仅相差 0.41%。多于 4 个的增益、长时间运行时的降频、实时换页与 DRAM 带宽都未实测。堆的最大实际占用前缀约 3 KiB，图和工作区在堆之外。硬件计数器可在固定输入上区分依赖等待、分支和缓存问题。GPU 上的并行化还需更换串行堆的执行方式，并处理 WGSL 缺少运行时 f64 及确定位级归并的问题。[重复 Worker 测试](../repeated-SjxJDO/summary.json) · [Apple CPU 计数器](https://developer.apple.com/documentation/xcode/addressing-cpu-bottlenecks) · [WGSL 数值类型](https://www.w3.org/TR/WGSL/#floating-point-types)

下一步优先比较上海 2010 年 278 站存档，以及目的地更少、更集中的地图，记录两种内核在分配块、季度、年度、自然月界的耗时、回退和全量输出。若要解决修建整条线路后等待，应另测提交、首次交通就绪及影响报告各自的时间。现有证据支持复用内置 WASM，把适用条件从旧 75% 规则重新标定；长期退化、渲染帧率和其他设备的选择仍是独立问题。

## 复现

在仓库根目录执行。离线脚本复用早停实验从指定测试导出生成的 `/tmp/metro-road-sample.bin`。若临时文件缺失，可用 `node evidence/road-workers/bench-early-stop.mjs 'savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json' /tmp/metro-early-stop-report.json` 重新生成。原生测试通过固定输入 SHA-256 后才调用编译模块。下例将编译结果与新的计时记录留在临时目录，适用于本机的 Homebrew Node 和 Apple Clang。

```sh
experiment=evidence/road-workers/language-analysis-20261117
trial_dir=$(mktemp -d)
cp "$experiment/sparse.cc" "$experiment/replay.cjs" "$trial_dir/"
clang++ -std=c++17 -O3 -mcpu=native -ffp-contract=off -fno-fast-math -bundle -undefined dynamic_lookup -I/opt/homebrew/include/node "$trial_dir/sparse.cc" -o "$trial_dir/sparse.node"
node "$trial_dir/replay.cjs"
node evidence/road-workers/wasm-dispatch-browser-GF8uPU/offline-handler.cjs
node "$experiment/oracle.mjs" /tmp/metro-road-sample.bin /tmp/metro-oracle.json
node "$experiment/weights.mjs" 'savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json' /tmp/metro-weights.json /tmp/metro-road-sample.bin
```

真实浏览器测试入口为 `node evidence/road-workers/wasm-dispatch-browser.mjs`，按项目的 metro-browser-check 约定使用独立的可见浏览器和 120 秒上限。
