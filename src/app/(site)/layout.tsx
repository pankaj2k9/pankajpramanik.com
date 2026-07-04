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
      <main className="flex-1">{children}</main>
      <Footer />
      <MusicPlayer />
    </>
  );
}
