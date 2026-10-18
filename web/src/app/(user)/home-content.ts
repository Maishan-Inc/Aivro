export const showcase = [
    { id: "desert", title: "风塑造的形状", category: "自然与空间", image: "/showcase/desert.webp", prompt: "辽阔荒漠中的红色砂岩山体，远处的孤峰与层叠岩壁，晴朗蓝天，温暖侧光，电影级风景摄影，宽画幅。" },
    { id: "architecture", title: "光的建筑", category: "自然与空间", image: "/showcase/architecture.webp", prompt: "极简白色建筑，几何线条与负空间，柔和的自然光，低角度仰拍，建筑摄影，干净而安静的构图。" },
    { id: "portrait", title: "目光之间", category: "人像与风格", image: "/showcase/portrait.webp", prompt: "蓝色与淡紫色光线下的棚拍人像，细腻的肤质，安静的神情，浅景深，柔和背景，时尚杂志风格。" },
    { id: "alpine", title: "山野的回声", category: "自然与空间", image: "/showcase/alpine.webp", prompt: "云雾环绕的壮阔山峰，清晨第一束光穿过云层，冷色调与温暖高光，极具层次的自然风景，电影感。" },
    { id: "space", title: "地球之外", category: "人像与风格", image: "/showcase/space.webp", prompt: "从太空望向地球，蓝色大气层的微光，深邃宇宙与星辰，科幻电影场景，超广角，细节丰富。" },
    { id: "coast", title: "潮汐的节奏", category: "自然与空间", image: "/showcase/coast.webp", prompt: "海浪与海岸相遇，蓝绿色海水，柔和光线，长曝光质感，极简自然摄影，宁静而有力量。" },
];

export const questions = [
    { question: "第一次使用，从哪里开始？", answer: "可以先浏览提示词库，选择喜欢的示例并点击生成；也可以直接进入生图工作台，描述你的想法。想把多个创作步骤组合起来时，再打开工作流。部分页面是否需要登录，以站点当前设置为准。" },
    { question: "工作流和独立工作台有什么区别？", answer: "独立工作台适合快速完成一次图片、视频或 3D 模型生成。工作流提供可连接的画布节点，方便将提示词、参考图片和生成步骤放在一起，继续调整与复用。" },
    { question: "可以使用哪些模型？", answer: "各工作台的模型选择器会展示当前站点开放的模型。图片、视频、文本和 3D 的可用模型分别配置，实际能力、参数和消耗以所选模型及页面提示为准。" },
    { question: "我的素材和生成记录会一直保留吗？", answer: "我的素材使用当前浏览器的本地存储，建议定期导出备份。生成记录及其关联文件有保留期限，请查看记录详情中的到期信息，并及时下载需要长期保存的作品。" },
    { question: "提示词反推和免费生成图片在哪里？", answer: "首页顶部导航和工作空间左侧的“探索更多”中都提供这两个入口。它们会在新标签页打开独立站点，服务规则以对应站点的说明为准。" },
];

export const toolDescriptions: Record<string, string> = {
    canvas: "把灵感、参考与生成步骤，连接成可复用的创作流程。",
    image: "从一句描述或一张参考图出发，探索画面的更多可能。",
    video: "编排主体、场景和镜头运动，让静态的想法开始流动。",
    "model-3d": "用文字或图片探索形体，调整网格、纹理与材质。",
    prompts: "发现好作品背后的表达方式，收藏并应用到下一次创作。",
    assets: "整理你的图片、视频、模型与文本，让灵感随时可用。",
    "prompt-reverse": "从喜欢的画面中寻找线索，探索如何表达视觉风格。",
    "free-image": "打开独立的免费生图工具，轻松尝试新的创意。",
};
