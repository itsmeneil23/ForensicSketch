import { useEffect, useRef } from "react";
import { Canvas, Image as FabricImage } from "fabric";

export default function GeneratePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvas = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 450,
      height: 500,
      backgroundColor: "#f5f5f5",
      selection: true,
    });

    fabricCanvas.current = canvas;

    return () => {
      canvas.dispose();
    };
  }, []);

  const addPart = async (src: string) => {
    if (!fabricCanvas.current) return;

    const img = await FabricImage.fromURL(src);

    img.set({
      left: 200,
      top: 200,
      scaleX: 0.5,
      scaleY: 0.5,
    });

    img.selectable = true;

    fabricCanvas.current.add(img);
    fabricCanvas.current.setActiveObject(img);
    fabricCanvas.current.renderAll();
  };

  const bringForward = () => {
    const obj = fabricCanvas.current?.getActiveObject();
    if (obj) fabricCanvas.current?.bringObjectForward(obj);
  };

  const sendBackward = () => {
    const obj = fabricCanvas.current?.getActiveObject();
    if (obj) fabricCanvas.current?.sendObjectBackwards(obj);
  };

  const deleteSelected = () => {
    const obj = fabricCanvas.current?.getActiveObject();
    if (obj) fabricCanvas.current?.remove(obj);
  };

  const download = () => {
    const dataURL = fabricCanvas.current?.toDataURL({
      format: "png",
    });

    const link = document.createElement("a");
    link.href = dataURL!;
    link.download = "sketch.png";
    link.click();
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "linear-gradient(90deg,#6a00a8,#d0006f)",
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          width: "220px",
          background: "#5a0096",
          padding: "15px",
          overflowY: "scroll",
        }}
      >
        <h2 style={{ color: "white" }}>Eyes</h2>

        <img
          src="/project/module1_face_comp/assets/eyes/eye1.png"
          width="70"
          style={{ cursor: "pointer" }}
          onClick={() =>
            addPart("/project/module1_face_comp/assets/eyes/eye1.png")
          }
        />

        <img
          src="/project/module1_face_comp/assets/eyes/eye2.png"
          width="70"
          style={{ cursor: "pointer", marginTop: "10px" }}
          onClick={() =>
            addPart("/project/module1_face_comp/assets/eyes/eye2.png")
          }
        />

        <h2 style={{ color: "white", marginTop: "20px" }}>Nose</h2>

        <img
          src="/project/module1_face_comp/assets/nose/nose1.png"
          width="70"
          style={{ cursor: "pointer" }}
          onClick={() =>
            addPart("/project/module1_face_comp/assets/nose/nose1.png")
          }
        />

        <img
          src="/project/module1_face_comp/assets/nose/nose2.png"
          width="70"
          style={{ cursor: "pointer", marginTop: "10px" }}
          onClick={() =>
            addPart("/project/module1_face_comp/assets/nose/nose2.png")
          }
        />

        <h2 style={{ color: "white", marginTop: "20px" }}>Mouth</h2>

        <img
          src="/project/module1_face_comp/assets/mouth/mouth1.png"
          width="70"
          style={{ cursor: "pointer" }}
          onClick={() =>
            addPart("/project/module1_face_comp/assets/mouth/mouth1.png")
          }
        />
      </div>

      {/* CANVAS AREA */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "15px",
            borderRadius: "10px",
          }}
        >
          <canvas ref={canvasRef} />
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            gap: "15px",
          }}
        >
          <button onClick={bringForward}>Bring Forward</button>
          <button onClick={sendBackward}>Send Backward</button>
          <button onClick={deleteSelected}>Delete</button>
          <button onClick={download}>Download Sketch</button>
        </div>
      </div>
    </div>
  );
}
