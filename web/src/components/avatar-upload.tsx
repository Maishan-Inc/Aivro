"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Area } from "react-easy-crop";
import { App, Button, Modal, Slider } from "antd";
import { Camera } from "lucide-react";
import { uploadAvatar } from "@/services/api/auth";
import { useUserStore } from "@/stores/use-user-store";

const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });

export function AvatarUpload() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const setSession = useUserStore((state) => state.setSession);
    const input = useRef<HTMLInputElement>(null);
    const [source, setSource] = useState("");
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [area, setArea] = useState<Area | null>(null);
    const [saving, setSaving] = useState(false);
    const [cropReady, setCropReady] = useState(false);

    useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);

    const select = async (file?: File) => {
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            message.error("头像仅支持 PNG、JPEG、WebP，文件不超过 5MB");
            return;
        }
        const url = URL.createObjectURL(file);
        try {
            const image = new window.Image();
            image.src = url;
            await image.decode();
            if (image.naturalWidth * image.naturalHeight > 32 * 1024 * 1024) throw new Error("图片尺寸过大，请选择较小的图片");
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setArea(null);
            setCropReady(false);
            setSource(url);
        } catch (error) {
            URL.revokeObjectURL(url);
            message.error(error instanceof Error ? error.message : "无法读取图片");
        }
    };

    const save = async () => {
        if (!source || !area || !token || saving) return;
        setSaving(true);
        try {
            const image = new window.Image();
            image.src = source;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 512;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("无法裁剪图片");
            context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("头像转换失败")), "image/png"));
            const user = await uploadAvatar(token, new File([blob], "avatar.png", { type: "image/png" }));
            setSession(token, user);
            setSource("");
            message.success("头像已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "头像上传失败");
        } finally {
            setSaving(false);
        }
    };

    return <>
        <Button size="small" icon={<Camera size={14} />} onClick={() => input.current?.click()}>上传头像</Button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void select(event.target.files?.[0]); event.target.value = ""; }} />
        <Modal centered title="裁剪头像" open={Boolean(source)} afterOpenChange={setCropReady} onCancel={() => { if (!saving) setSource(""); }} onOk={() => void save()} okText="保存头像" cancelText="取消" confirmLoading={saving} okButtonProps={{ disabled: !area }} width={520} destroyOnHidden maskClosable={!saving} closable={!saving} keyboard={!saving}>
            <div className="relative mt-4 h-[min(48svh,340px)] overflow-hidden rounded-xl bg-muted">{cropReady ? <Cropper image={source} crop={crop} zoom={zoom} aspect={1} cropShape="round" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} /> : null}</div>
            <div className="mt-5 flex items-center gap-4"><span className="text-xs text-muted-foreground">缩放</span><Slider className="flex-1" min={1} max={3} step={0.01} value={zoom} onChange={setZoom} disabled={saving} /></div>
            <p className="mb-2 text-xs leading-6 text-muted-foreground">拖动图片调整位置。支持 PNG、JPEG、WebP，最大 5MB；保存为 512 × 512 PNG。</p>
        </Modal>
    </>;
}
