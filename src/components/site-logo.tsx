import Image from "next/image";
import { SITE_LOGO_PATH } from "@/lib/site-brand";

export function SiteLogo({ priority = false }: { priority?: boolean }) {
  return (
    <sgp-logo>
      <Image src={SITE_LOGO_PATH} alt="" width={225} height={225} priority={priority} />
    </sgp-logo>
  );
}
