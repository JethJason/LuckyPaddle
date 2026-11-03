import "../globals.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="bg-scene" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[26rem] bg-gradient-to-b from-blue-100/34 via-yellow-50/24 to-transparent"></div>
      <div className="pointer-events-none fixed -left-36 top-30 -z-10 h-72 w-72 rounded-full bg-blue-300/18 blur-3xl"></div>
      <div className="pointer-events-none fixed -right-40 top-20 -z-10 h-80 w-80 rounded-full bg-red-300/16 blur-3xl"></div>
      <div className="pointer-events-none fixed left-1/3 bottom-[-16rem] -z-10 h-[24rem] w-[24rem] rounded-full bg-yellow-200/22 blur-3xl"></div>
      {children}
    </div>
  );
}
