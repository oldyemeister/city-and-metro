# School campus labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 学校名称与校区在设施标注中分行显示。

**Architecture:** 保留单行完整名称供详情使用；上海大学设施的 label 写入换行，设施图层和普通地图按每行测宽、绘制和避让。沿用现有字体、颜色与图集。

**Tech Stack:** JavaScript、Canvas 2D、Node。

**Spec:** 原对话“梳理性能优化思路与协作方式”最后请求：学校名换行后显示“（邯郸校区）”；本对话授权完成实现。

## Global Constraints

- 保留设施 ID、坐标、权重、启用日期和历史事件顺序。
- 不新增尚未核实的高校设施；仅明确复旦邯郸及已有名称中的徐汇、宝山、延安路校区。
- 其他设施和其他地图维持现有呈现；保留其他未提交工作。

## Review Focus

- 两行名称的总高度参与避让；客流统计位于校区名下方。
- 普通地图地标绑定学校也使用新标签。
- 未标校区的学校维持一行；非学校仍使用原有简称。

### Task 1: Data and canvas labels

**Files:** Modify `js/data_sh.js`, `js/render.js`; update `EDUCATION-PLAN.md`, `STATUS.md`, `DEVELOPMENT.md`.

**Interfaces:** Existing facility `label` supplies newline-separated display text; `name` stays a full single-line title.

- [x] 为复旦、交大徐汇、上大宝山、东华延安路写入两行 label。
- [x] 设施/服务缺口及普通地图使用逐行绘制、最大行宽和完整高度避让。
- [x] 运行 baseline verify、build、verify、diff check 和聚焦 Canvas 检查，并检查预览。
- [x] 记录实际验证结果和剩余教育规划；不提交其他用户修改。
