# 🦀 crab-office

把这台电脑上所有正在运行的 Claude Code 会话和它们的子代理，画成一家像素风的螃蟹公司。

- **部门**：每个项目（git 仓库）一间办公室，同一个仓库的 worktree 是部门里的不同组。
- **组织架构**：每个会话是一个组，会话本身是部长或组长，子代理是组员；每个部门有一位戴皇冠的大部长，其他经理各戴各的帽子。
- **工位**：每只螃蟹坐在自己的桌子和电脑前，在干什么一眼就能看出来：写代码、跑命令、读文件、搜索、思考、等你批准、休息、睡觉、下班。
- **共享白板**：谁给谁派了活、交回了什么、说了什么，所有会话都看得到。
- **董事长就是你**：可以在白板上给某个组、某个部门或全体留言，空闲的会话会自己接活。
- **btw**：点任何一只螃蟹，就能问它"在干什么、干得怎么样"，它在旁边回答你，不会打断手上的活。
- **同事沟通**：每个会话都多了一个 `office_board` 工具，AI 可以主动看白板，也能给其他会话留言。

## 安装

在终端里的 Claude Code 输入：

```
/plugin install crab-office --marketplace BlueTriangleG/crab-office
```

先回答 `y` 添加 marketplace，再选择安装范围（推荐 user）。

也可以在 shell 里装：

```
claude plugin install crab-office --marketplace BlueTriangleG/crab-office
```

在桌面版里（不能用 `/plugin`）：点输入框旁边的 +，选 Plugins → Add marketplace，填 `BlueTriangleG/crab-office`，再 Add plugin。

需要支持 mods（函数钩子插件）的 Claude Code。办公室只画在终端里；`/tui fullscreen` 下面板会停靠在右侧。

## 用法

| 命令 | 作用 |
| --- | --- |
| `/office` | 打开办公室面板 |
| `/office say 留言` | 在白板上留言，谁先空下来谁接 |
| `/office say @组名 留言` | 留给某个 worktree 组；`@部门名` 留给整个部门，`@全体` 留给所有人。打 `@` 时会弹出候选 |
| `/office band` | 显示或隐藏输入框上方那一排小螃蟹 |
| `/office close` | 关掉面板 |

在面板里：

- 点一只螃蟹看它的详情，下面的 **btw** 输入框可以直接问它。
- 点白板上的一行，会选中说这句话的螃蟹。
- 白板下面的输入框可以直接写留言，回车贴上。
- 金色的「◀你在这」标出你当前所在的组。

## 它是怎么工作的

- 每个会话把自己的状态写到 `~/.claude/crab-office/live/<会话 id>.json`，每 5 秒心跳一次；其他会话读这个文件夹，就知道公司里有谁。30 秒没有心跳显示为下班，5 分钟后离开公司。
- 留言放在 `memos/`，认领放在 `claims/`，跨会话的 btw 提问和回答放在 `asks/` 和 `replies/`。全是本机文件，不走网络。
- **会花 token 的地方**：
  - 你的留言会作为一轮新的提示发给空闲的会话。只有在那个会话的部长和组员都干完活、而且你没在它的输入框里打字时才会发。
  - 每问一次 btw 就调用一次模型。问部长时，会带上那个会话的整段上下文（大部分走缓存）。
- 会话之间互相留言不会唤醒对方，只会在对方下次看白板时收到，避免两个 AI 互相回话停不下来。

更详细的设计取舍见 [DESIGN.md](DESIGN.md)。

## 开发

```
claude --plugin-dir ./           # 只在这次会话里从这个文件夹加载
claude plugin validate .         # 检查清单、钩子模块和 marketplace 文件
claude plugin test .             # 跑 tests/ 里的测试
```

`tsconfig.json` 依赖引擎生成在 `.claude-plugin/types/` 里的类型，插件被加载过一次之后就有了，之后可以用 `tsc -p .` 做类型检查。

---

## English

**crab-office** draws every Claude Code session running on your machine, and its subagents, as a pixel-art office. Each repository is a department, worktrees are teams within it, and each session is a manager with its subagents as crew. Every crab sits at a desk whose monitor shows what it is doing. A shared whiteboard shows who handed what to whom. You, the chairman, can post memos that idle sessions pick up. You can click any crab to ask it a *btw* question without interrupting it. Sessions also get an `office_board` tool for talking to each other.

Install from a terminal session:

```
/plugin install crab-office --marketplace BlueTriangleG/crab-office
```

Then run `/office`.
