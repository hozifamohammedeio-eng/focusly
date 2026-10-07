import { ImageResponse } from "next/og";

export const alt = "Focusly — Study, progress, and build your city";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#f5f4f0", color: "#202120", padding: 64, alignItems: "center", gap: 40 }}>
      <div style={{ display: "flex", flexDirection: "column", width: 610 }}>
        <div style={{ fontSize: 38, marginBottom: 50 }}>focusly.</div>
        <div style={{ fontSize: 66, lineHeight: 1.1 }}>Your study life.</div>
        <div style={{ fontSize: 66, lineHeight: 1.1, color: "#686b70" }}>Beautifully organized.</div>
        <div style={{ fontSize: 24, marginTop: 40 }}>Study → Progress → Build your city</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, width: 350, height: 280, borderBottom: "8px solid #bbb9c6", paddingBottom: 16 }}>
        {[120,200,150,240].map((height,index) => <div key={height} style={{ display: "flex", width: 68, height, borderRadius: "16px 16px 4px 4px", background: index % 2 ? "#7770a2" : "#323a41", padding: 16 }}><div style={{ width: 30, height: 12, borderRadius: 3, background: "#f5f4f0" }} /></div>)}
      </div>
    </div>, size,
  );
}
