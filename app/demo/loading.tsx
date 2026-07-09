"use client";

export default function DemoLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        gap: 14,
      }}
    >
      <style>{`@keyframes d-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "2px solid rgba(185,156,255,0.20)",
          borderTopColor: "#b99cff",
          animation: "d-spin 0.75s linear infinite",
        }}
      />
      <p
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "rgba(169,184,166,0.55)",
          textTransform: "uppercase",
        }}
      >
        Loading Demo…
      </p>
    </div>
  );
}
