import Header from "@/components/site/Header";
import HomeFooter from "@/components/home/HomeFooter";
import WhatsAppButton from "@/components/site/WhatsAppButton";
import MusicPlayer from "@/components/site/MusicPlayer";
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="home-shell">
      <Header />
      {children}
      <HomeFooter />
      <MusicPlayer expandable />
      <WhatsAppButton />
    </div>
  );
}
