import RuntimeCanvas from '@/components/runtime/RuntimeCanvas';
import RuntimeHUD from '@/components/runtime/RuntimeHUD';
import ReplayController from '@/components/runtime/ReplayController';

export default function Home() {
  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden">
      <RuntimeCanvas />
      <RuntimeHUD />
      <ReplayController />
    </main>
  );
}