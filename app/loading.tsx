import TennisBallLoader from "@/components/common/TennisBallLoader";

export default function Loading() {
  return (
    <main className="flex min-h-[100svh] w-full items-center justify-center px-4"
      style={{ background: "#0B1929" }}>
      <TennisBallLoader variant="inline" />
    </main>
  );
}
