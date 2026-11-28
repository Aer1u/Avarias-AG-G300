import { Plus_Jakarta_Sans } from "next/font/google"
import { ControlePKView } from "@/components/controle-pk/ControlePKView"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
})

export default function ControlePKPage() {
  return (
    <div className={`${plusJakarta.className} font-light antialiased`}>
      <ControlePKView />
    </div>
  )
}
