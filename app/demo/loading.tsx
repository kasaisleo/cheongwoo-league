export default function DemoLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <p
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 13,
          letterSpacing: "0.18em",
          color: "rgba(245,240,232,0.45)",
          textTransform: "uppercase",
        }}
      >
        Loading Demo…
      </p>
    </div>
  );
}
