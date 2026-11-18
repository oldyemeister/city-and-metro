# 道路 WASM 的找路和流量分配

2026-11-17 在 macOS ARM64 上使用 Node 23.11.0 / V8 12.9 回放两份游戏输入。上海从 2010 年 1 月 16 日的 278 站经营存档开始，伦敦从 1860 年经营开局开始。两份测试输入都是下次跨月的第一次工作日道路分配。使用游戏已经内嵌的 WASM 二进制，SHA-256 为 `58a691130b3df19c45cd9c1dfbad81813866129f4bdf37be83212d3c606337ac`。发布内核、游戏依赖和玩法没有本轮变更。

## 同一次分配的内核耗时

每份地图在一个线程中顺序回放 32 个块。原版和加计时点的版本各预热两遍，先比对结果，再以相反顺序交替测六对。表中是每遍各块的 WASM `solve` 耗时之和的中位数。百分比先在每遍内求出，再取中位数，因此表中各列可能有舍入差。计时不含 Worker 排队、数据传输、JS 数组转换和绘制。

| 阶段 | 上海 32 块，毫秒 / 占比 | 伦敦达到 10% 门槛的 6 块，毫秒 / 占比 |
| --- | ---: | ---: |
| 从各起点建最短路树，包括初始化距离、堆操作和沿道路更新路径 | 718.39 / 93.17% | 7.94 / 78.86% |
| 选择各终点分区的接入点，写时间和里程，将出行量计入接入点 | 21.52 / 2.80% | 1.35 / 13.51% |
| 沿最短路树倒序，把车流累加到经过的路段 | 29.24 / 3.79% | 0.61 / 6.08% |
| 输入检查、输出清零和循环管理等 | 1.81 / 0.23% | 0.15 / 1.53% |
| 加计时点的总耗时 | 771.06 | 10.06 |
| 原版总耗时 | 774.53 | 10.14 |

上海 32 块全部达到游戏的 10% 门槛。为比较相同算法在小路网上的行为，伦敦实验让全部 32 块都走 WASM，再单独汇总其中符合现有门槛的 6 块。强制走 WASM 的 32 块合计为 39.03 毫秒，其中找路、选择终点、流量回溯分别占 75.60%、17.13%、5.13%。伦敦表中的 6 块没有计入其余 26 块在游戏里走 JS 所需的时间。上海原版六次为 763.42–785.65 毫秒，计时版为 751.53–817.17 毫秒。两侧总耗时的微小差异不能解释为加速。[上海逐轮时间](shanghai2010-timing.json) · [伦敦逐轮时间](london1860-timing.json)

每个起点的计时点在树搜索、终点扫描和反向流量传递的阶段边界。每块另有入口和出口计时。额外的 JS 外层计时括住同一个导出的 `solve` 调用，覆盖 WASM 入口和出口的少量间隙。在每一遍回放中，全量稠密的时间与距离行和原版一致。按游戏实际使用的请求核对了两张地图的时间、里程、不可达值、所有 32 个块各自的流量，以及按原顺序合并的逐路段流量，全部与独立同步 JS 参照的字节哈希一致。[计时点和二进制校验](wasm-probe.mjs) · [逐块核验和计时脚本](profile-allocation.mjs)

从头生成两份输入后，各重复六对交替计时。上海用于找路、终点选择和流量回溯的时间占比分别为 93.17%、2.80%、3.77%。伦敦达到门槛的六块分别为 78.39%、13.83%、6.18%。独立重跑的操作次数、可达与不可达请求的结果、32 个块各自的流量及合并流量哈希也都复现。[上海复测](replay/shanghai2010-timing.json) · [伦敦复测](replay/london1860-timing.json)

## 上海的实际工作量

单独回放 1,341 棵最短路树，使用只累加次数的 WASM，避免在热循环计时。8,747 个节点、25,386 条有向路段上，共确定了 11,521,512 次节点最短时间，检查了 33,786,990 条出边。12,638,767 次弹出堆顶中有 1,117,255 次取出的是已被更短路径替代的记录。堆下沉进行了 150,779,110 次键比较、73,040,497 次下移，入堆上移合计 2,094,824 次。这些次数反映算法工作量。

终点扫描写出 1,921,571 对可达起终点的时间和里程，本次实际请求的可达组合是 406,820 对。反向流量分配倒序访问了 11,521,512 个已确定的节点，有 2,030,042 次向前驱路段累加了实际车流。两版对全部 407,301 个请求的结果一致，包括 481 个不可达请求。[上海计数](shanghai2010-counts.json) · [伦敦计数](london1860-counts.json)

还在完全原版的二进制上使用 V8 采样器记录正在执行的机器指令。预热后四遍上海分配共取得 3,692 个样本，其中 3,657 个位于优化后的 `solve` 内。以这 3,657 个样本为分母，1,892 个（51.74%）落在弹出堆顶和下沉区段，1,019 个（27.86%）落在沿出边寻找更短路径和入堆区段。V8 提供的两个相邻位置跨越源码区段时不作归属，保留了 480 个（13.13%）未归属样本。这组采样用来排列优化优先级，每行代码的精确耗时和 CPU 缓存行为仍未测量。下一项适合对照测试的是热区内堆顶下沉的开销，尤其是左右子节点的比较和移动；沿出边更新路径是第二项。测试改动时须复核等长路径的先后顺序及逐路段车流。[原版机器指令样本和归属规则](shanghai2010-stock-pcs.json) · [采样脚本](sample-stock-tree.mjs)

## 加开上海 1 号线大站快车

从同一暂停的 278 站上海存档调用游戏自己的加开交路操作，到出行模型完成更新为止。使用四个真正并行的 Node 道路 Worker，另有两个方式选择和两个地铁 Worker。游戏维持 10% 门槛，每次操作的 32 次道路分配、1,024 块全部使用 WASM，四个道路 Worker 各处理 256 块，总共计算 42,912 棵树。记录时段内触发横幅的模型条件依次为关、开、关。

| 运行顺序 | 模型结算经过时间 | 4 个 Worker 的 WASM 耗时之和 | 建树占内部时间 |
| --- | ---: | ---: | ---: |
| 原版，第 1 次 | 7.050 秒 | 25.790 秒 | — |
| 计时版，第 1 次 | 6.923 秒 | 25.267 秒 | 93.21% |
| 计时版，第 2 次 | 6.928 秒 | 25.403 秒 | 93.23% |
| 原版，第 2 次 | 7.418 秒 | 26.956 秒 | — |

两次计时版所有线程、所有分配的阶段时长合并后，找路占 93.22%，选择终点占 2.79%，向路段分配车流占 3.76%，其余占 0.24%。Worker 可以同时运行，阶段时长也会包含线程等待调度的时间。模型结算的实耗取第一列秒数。观察版比原版的平均模型时间短 4.26%，这组用于定位阶段的测试不能证明游戏获得了加速。桌面和手机浏览器中从点击到横幅消失的时间未在本轮测量。

每次运行均核对 32 份道路分配的路段时间、起点、终点和需求输入哈希。操作前及结算后，8 个时段内共 232 份交通数组的类型、长度和内容，以及日汇总、经营、账本、时钟和线网状态与对照逐项一致，也与先前同一操作的 JS/WASM 对照一致。[四次原始数据和比较](banner-comparison.json) · [游戏操作和 Worker 探针](profile-banner.mjs)

## 复现

从仓库根目录运行。上海使用已有的 278 站导出。伦敦须以 `ld` 创建 1860 年经营开局，在同一进程导出并恢复，才能重现计时脚本校验的输入哈希。单独恢复同一伦敦导出时，路网数组、路段通行时间和需求相同。运行时路网编号 `G.id` 会变化，序列化文件的哈希也随之改变。以下命令将新建的伦敦导出和两份道路输入写入临时目录。单线程计时和四 Worker 计时应分开运行。

```sh
node evidence/road-workers/dispatch-calibration/capture-small-map.mjs --restore savedgames/test/Shanghai-2010-01-278.cmsave.json /tmp/metro-dispatch-sh2010.bin
node evidence/road-workers/dispatch-calibration/capture-small-map.mjs ld /tmp/metro-dispatch-london.cmsave.json /tmp/metro-dispatch-london.bin
node evidence/road-workers/wasm-internals/profile-allocation.mjs /tmp/metro-dispatch-sh2010.bin evidence/road-workers/dispatch-validation/sh2010-exact.json /tmp/metro-shanghai-timing.json
node evidence/road-workers/wasm-internals/profile-allocation.mjs /tmp/metro-dispatch-london.bin evidence/road-workers/dispatch-validation/london-exact.json /tmp/metro-london-timing.json
node evidence/road-workers/wasm-internals/count-operations.mjs /tmp/metro-dispatch-sh2010.bin /tmp/metro-shanghai-counts.json
node evidence/road-workers/wasm-internals/count-operations.mjs /tmp/metro-dispatch-london.bin /tmp/metro-london-counts.json --london-forced
node evidence/road-workers/wasm-internals/sample-stock-tree.mjs /tmp/metro-dispatch-sh2010.bin /tmp/metro-shanghai-stock-pcs.json
```

四 Worker 回放和结果复核可单独执行。两种运行使用同一个 10% 启用条件。

```sh
node evidence/road-workers/wasm-internals/profile-banner.mjs plain /tmp/metro-banner-plain-a.json
node evidence/road-workers/wasm-internals/profile-banner.mjs profile /tmp/metro-banner-profile-a.json
node evidence/road-workers/wasm-internals/profile-banner.mjs profile /tmp/metro-banner-profile-b.json
node evidence/road-workers/wasm-internals/profile-banner.mjs plain /tmp/metro-banner-plain-b.json
node evidence/road-workers/wasm-internals/compare-banner.mjs /tmp/metro-banner-plain-a.json /tmp/metro-banner-profile-a.json /tmp/metro-banner-profile-b.json /tmp/metro-banner-plain-b.json /tmp/metro-banner-comparison.json
```
