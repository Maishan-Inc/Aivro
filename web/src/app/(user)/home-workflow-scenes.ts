export const workflowScenes = [
    {
        id: "product", title: "商品广告", subtitle: "一件商品，延展整套视觉",
        prompt: "保留琥珀色香水瓶、奶油色瓶盖与标签，分别探索日光石台和暗调水景，建立统一的商品视觉。",
        brief: "锁定瓶型与材质，拆分两种布光方案。", constraint: "瓶身、瓶盖、标签保持一致",
        reference: "product-reference", referenceTitle: "商品原图", branches: ["日光广告图", "暗调广告图"],
        outputs: ["product-campaign", "product-detail"], next: "组合商品主图与广告素材", format: "3:2", deliverable: "商品视觉套图",
    },
    {
        id: "anime", title: "动漫手办", subtitle: "从角色设定到收藏级展示",
        prompt: "将薄荷绿短发信使的角色设定转为树脂手办，保留围巾、挎包与望远镜，探索棚拍与收藏展示。",
        brief: "提取角色特征，分别设计材质和展示环境。", constraint: "发型、服装、道具保持一致",
        reference: "anime-reference", referenceTitle: "角色设定图", branches: ["树脂手办棚拍", "收藏柜展示"],
        outputs: ["anime-studio", "anime-display"], next: "整理角色与手办商品展示", format: "3:2", deliverable: "角色商品视觉",
    },
    {
        id: "game", title: "游戏道具", subtitle: "让同一道具进入游戏世界",
        prompt: "以青铜星月提灯为基准，保留六角灯笼与青色水晶，制作材质特写和森林遗迹中的场景效果图。",
        brief: "识别轮廓与材质，拆分道具和环境两条分支。", constraint: "提灯轮廓、水晶与纹饰保持一致",
        reference: "game-reference", referenceTitle: "道具概念图", branches: ["道具材质渲染", "遗迹场景融合"],
        outputs: ["game-studio", "game-scene"], next: "整理建模与关卡美术参考", format: "3:2", deliverable: "游戏美术参考包",
    },
    {
        id: "cinema", title: "影视场景", subtitle: "同一座基地，不同的叙事时刻",
        prompt: "保持峡谷基地的穹顶、栈桥与机位不变，分别探索蓝调夜景和沙尘将至的黄昏，为镜头设计建立气氛。",
        brief: "锁定场景布局，为同一机位设计两种气氛。", constraint: "建筑、地形、机位保持一致",
        reference: "cinema-reference", referenceTitle: "场景基准图", branches: ["蓝调夜景", "沙尘黄昏"],
        outputs: ["cinema-night", "cinema-storm"], next: "整理场景气氛与镜头参考", format: "3:2", deliverable: "影视场景气氛图",
    },
    {
        id: "video", title: "视频生成", subtitle: "从参考帧到连续镜头",
        prompt: "以林间兔子的参考帧规划动画镜头，分析主体动作与环境变化，连接视频生成节点并预览动态结果。",
        brief: "提取主体与环境，规划连续动作和镜头节奏。", constraint: "参考帧与演示片段来自同一场景",
        reference: "video-reference", referenceTitle: "视频参考帧", branches: ["起始画面", "后续画面"],
        outputs: ["video-reference", "video-ending"], next: "预览视频并继续编排镜头", format: "20:11", deliverable: "动态镜头预览",
        video: "https://www.w3schools.com/html/mov_bbb.mp4",
        frameTimes: [1, 6], source: "https://peach.blender.org/", credit: "Big Buck Bunny · Blender Foundation",
    },
    {
        id: "model3d", title: "3D 模型", subtitle: "从参考图到可旋转的模型",
        prompt: "参考玩具跑车的轮廓与材质，生成可旋转查看的 3D 模型。",
        brief: "保留车身比例，检查材质和网格。", constraint: "生成后切换贴图、白模和线框预览",
        reference: "/workflow/model3d/toy-car.jpg", referenceTitle: "模型参考图", branches: ["3D 模型"],
        outputs: [], next: "旋转模型并检查网格", format: "1:1", deliverable: "3D 模型",
        model3D: "/workflow/model3d/toy-car.glb",
    },
] as const;

export const workflowSteps = ["整理参考", "拆解创意", "分支生成", "对比结果", "继续创作"];
