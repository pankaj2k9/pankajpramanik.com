import "@/styles/inner.css";
import WhatsAppButton from "@/components/site/WhatsAppButton";
import Header from "@/components/site/Header";
import HomeFooter from "@/components/home/HomeFooter";
import MusicPlayer from "@/components/site/MusicPlayer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="inner-shell flex min-h-dvh flex-col">
      <Header />
      <main id="main-content" className="ip-main flex-1">
        {children}
      </main>
      <HomeFooter />
      <MusicPlayer expandable />
      <WhatsAppButton />
    </div>
  );
}
