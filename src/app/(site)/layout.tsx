import WhatsAppButton from "@/components/site/WhatsAppButton";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import MusicPlayer from "@/components/site/MusicPlayer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <MusicPlayer />
      <WhatsAppButton />
    </>
  );
}
