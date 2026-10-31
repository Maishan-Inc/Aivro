import type { ComponentProps } from "react";
import { Zap } from "lucide-react";
import type { Model3DGenerationInput } from "@/services/api/model-3d";

export function CreditSymbol({ className, ...props }: ComponentProps<"span">) {
    return (
        <span {...props} className={`inline-flex items-center justify-center ${className || ""}`}>
            <Zap className="size-[1em] fill-current" strokeWidth={2.4} />
        </span>
    );
}

export type ModelCreditCost = {
    model: string;
    credits: number;
};

export type GenerationKind = "image" | "video" | "text" | "model3d";
export type Model3DPricing = Pick<Model3DGenerationInput, "quantity" | "meshQuality" | "textureEnabled" | "pbrEnabled" | "targetFaceCount">;

export function model3DCreditMultiplier(input: Model3DPricing, base = 1) {
    const quality = input.meshQuality === "high" ? 1.6 : input.meshQuality === "ultra" ? 2.5 : 1;
    const material = 1 + (input.textureEnabled ? 0.2 : 0) + (input.pbrEnabled ? 0.3 : 0);
    const faces = input.targetFaceCount > 0 ? input.targetFaceCount : 500000;
    return base * quality * material * (1 + Math.max(0, faces - 500000) / 1000000);
}

export function modelCreditCost(modelCosts: ModelCreditCost[] | undefined, model: string) {
    return modelCosts?.find((item) => item.model === model)?.credits || 0;
}

export function requestCreditCost(options: { modelCosts?: ModelCreditCost[]; model: string; count?: string | number; model3D?: Model3DPricing }) {
    const base = modelCreditCost(options.modelCosts, options.model);
    if (!base) return 0;
    if (options.model3D) {
        const quantity = Math.max(1, Math.min(4, Math.floor(options.model3D.quantity) || 1));
        return Math.max(1, Math.floor(model3DCreditMultiplier(options.model3D, base * quantity)));
    }
    const count = Math.max(1, Math.floor(Math.abs(Number(options.count)) || 1));
    return base * count;
}
