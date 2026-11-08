import { HomeClientPage } from "@/app/(user)/home-client-page";
import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = async () => ({ ...await generateLocalizedMetadata("home"), robots: { index: false, follow: false } });

export default function HomePage() {
    return <HomeClientPage />;
}
