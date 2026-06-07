import { HomeClientPage } from "@/app/(user)/home-client-page";
import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("home");

export default function IndexPage() {
    return <HomeClientPage />;
}
